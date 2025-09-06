"""
Heuristic audit parser for OAG/COB PDFs.
Extracts audit findings (queries) with fields suitable for persistence and caching.

Approach:
- Use text from pages and any extracted tables to find lines or rows that look like audit findings.
- Detect amounts (KES/USD), severity keywords, recommendations, and fiscal period.
- Infer entity (county) from document title or content.

This is a best-effort MVP parser; it favors recall over precision and adds confidence scores
and provenance for downstream review and triage.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from .normalizer import DataNormalizer
except Exception:  # pragma: no cover - fallback for script imports
    from normalizer import DataNormalizer

# Optional OCR
try:
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore
    Image = None  # type: ignore


# Minimal county list for entity inference; can be expanded or loaded from DB later
COUNTY_NAMES: List[str] = [
    "Nairobi",
    "Mombasa",
    "Kisumu",
    "Nakuru",
    "Kiambu",
    "Machakos",
    "Uasin Gishu",
    "Kajiado",
    "Kakamega",
    "Bungoma",
    "Kericho",
    "Bomet",
    "Turkana",
    "West Pokot",
    "Samburu",
    "Trans Nzoia",
    "Elgeyo Marakwet",
    "Nandi",
    "Baringo",
    "Laikipia",
    "Narok",
    "Siaya",
    "Homa Bay",
    "Migori",
    "Kisii",
    "Nyamira",
    "Busia",
    "Vihiga",
    "Embu",
    "Meru",
    "Tharaka Nithi",
    "Kitui",
    "Makueni",
    "Nyandarua",
    "Nyeri",
    "Kirinyaga",
    "Garissa",
    "Wajir",
    "Mandera",
    "Marsabit",
    "Isiolo",
    "Kilifi",
    "Tana River",
    "Lamu",
    "Taita Taveta",
]


SEVERITY_KEYWORDS = {
    "critical": [
        "irregular expenditure",
        "unsupported payment",
        "unaccounted",
        "embezzlement",
        "misappropriation",
        "fraud",
    ],
    "warning": [
        "non-compliance",
        "late submission",
        "procurement issue",
        "weak controls",
        "pending bills",
    ],
}

OAG_SECTION_CUES = [
    r"management responses?",
    r"audit findings?",
    r"recommendations?",
    r"basis of opinion",
    r"qualified opinion|adverse opinion|disclaimer",
]


@dataclass
class AuditFinding:
    finding_text: str
    severity: str
    amount: Optional[Dict[str, Any]]
    recommended_action: Optional[str]
    period: Optional[Dict[str, Any]]
    entity: Optional[Dict[str, Any]]
    provenance: Dict[str, Any]


class AuditParser:
    def __init__(self) -> None:
        self.normalizer = DataNormalizer()

    def infer_entity(
        self, title: str, pages: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        # Prefer title-based inference
        text = title or ""
        for county in COUNTY_NAMES:
            if county.lower() in text.lower():
                return {
                    "canonical_name": f"{county} County",
                    "type": "county",
                    "confidence": 0.9,
                    "raw_name": county,
                    "category": "counties",
                }

        # Fallback: first page text
        if pages:
            page_text = pages[0].get("text", "")
            for county in COUNTY_NAMES:
                if county.lower() in page_text.lower():
                    return {
                        "canonical_name": f"{county} County",
                        "type": "county",
                        "confidence": 0.6,
                        "raw_name": county,
                        "category": "counties",
                    }
        return None

    def classify_severity(self, text: str, amount_kes: Optional[float]) -> str:
        tl = text.lower()
        for sev, keys in SEVERITY_KEYWORDS.items():
            if any(k in tl for k in keys):
                return sev
        if amount_kes and amount_kes >= 50_000_000:  # >= 50M KES → critical
            return "critical"
        if amount_kes and amount_kes >= 5_000_000:
            return "warning"
        return "info"

    def extract_recommendation(self, text: str) -> Optional[str]:
        m = re.search(r"recommendation[:\-]\s*(.+)$", text, re.I)
        return m.group(1).strip() if m else None

    def parse_from_text_lines(
        self,
        text: str,
        page_number: int,
        period_hint: Optional[Dict[str, Any]],
        entity_hint: Optional[Dict[str, Any]],
    ) -> List[AuditFinding]:
        findings: List[AuditFinding] = []
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        for ln in lines:
            # Heuristic: lines containing money plus an audit cue
            if (
                re.search(r"\b(KES|Ksh|KSh|US\$|USD|,\d{3})\b", ln, re.I)
                or re.search(
                    r"audit|query|finding|irregular|unaccounted|pending bills|procurement|unsupported|vouch|loss|embezzlement",
                    ln,
                    re.I,
                )
                or any(re.search(cue, ln, re.I) for cue in OAG_SECTION_CUES)
            ):
                amt = self.normalizer.normalize_amount(ln) or None
                amount_kes = amt.get("base_amount") if amt else None
                sev = self.classify_severity(ln, amount_kes)
                rec = self.extract_recommendation(ln)
                findings.append(
                    AuditFinding(
                        finding_text=ln,
                        severity=sev,
                        amount=amt,
                        recommended_action=rec,
                        period=period_hint,
                        entity=entity_hint,
                        provenance={"page": page_number, "line": ln[:80]},
                    )
                )
        return findings

    def parse_tables(
        self,
        tables: List[Dict[str, Any]],
        period_hint: Optional[Dict[str, Any]],
        entity_hint: Optional[Dict[str, Any]],
    ) -> List[AuditFinding]:
        findings: List[AuditFinding] = []
        for t in tables:
            # Different extractors store differently
            page = t.get("page") or t.get("data", {}).get("page_number") or 1
            headers = t.get("headers") or t.get("data", {}).get("headers") or []
            rows = t.get("rows") or t.get("data", {}).get("rows") or []
            # Identify typical columns
            joined_headers = " ".join([str(h).lower() for h in headers])
            has_description = re.search(
                r"description|finding|query|issue", joined_headers
            )
            has_amount = re.search(r"amount|kes|ksh|value", joined_headers)
            for row in rows:
                cells = [str(c) for c in row]
                text_blob = " ".join(cells)
                if (
                    has_description
                    or has_amount
                    or re.search(r"audit|query|finding|issue", text_blob, re.I)
                ):
                    amt = self.normalizer.normalize_amount(text_blob) or None
                    amount_kes = amt.get("base_amount") if amt else None
                    sev = self.classify_severity(text_blob, amount_kes)
                    rec = self.extract_recommendation(text_blob)
                    findings.append(
                        AuditFinding(
                            finding_text=text_blob,
                            severity=sev,
                            amount=amt,
                            recommended_action=rec,
                            period=period_hint,
                            entity=entity_hint,
                            provenance={
                                "page": page,
                                "table_index": t.get("table_index", 0),
                            },
                        )
                    )
        return findings

    def detect_period(
        self, title: str, pages: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        # Title hint
        p = self.normalizer.normalize_fiscal_period(title)
        if p:
            return p
        # First 2 pages
        for pg in pages[:2]:
            p = self.normalizer.normalize_fiscal_period(pg.get("text", ""))
            if p:
                return p
        return None

    def parse(
        self, extraction_result: Dict[str, Any], doc_meta: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Return normalized audit findings ready for DB or cache."""
        pages = extraction_result.get("pages", [])
        # OCR fallback if no text extracted
        if not pages and pytesseract is not None and Image is not None:
            # Attempt naive OCR on first few pages if images are provided (out-of-scope here);
            # left as a hook for future enhancement where page images are available.
            pass
        tables = []
        # Normalize table listing across extractors
        for t in extraction_result.get("tables", []) or []:
            if "data" in t:
                d = t["data"]
                d["page"] = t.get("page") or d.get("page")
                d["table_index"] = t.get("table_index", d.get("table_index", 0))
                tables.append(d)
            else:
                tables.append(t)

        title = doc_meta.get("title") or Path(doc_meta.get("file_path", "")).name
        entity_hint = self.infer_entity(title, pages)
        period_hint = self.detect_period(title, pages)

        findings: List[AuditFinding] = []
        # From text pages
        for pg in pages:
            text = pg.get("text", "")
            if text:
                findings.extend(
                    self.parse_from_text_lines(
                        text, pg.get("page_number", 1), period_hint, entity_hint
                    )
                )
        # From tables
        findings.extend(self.parse_tables(tables, period_hint, entity_hint))

        # Deduplicate by text+page
        seen = set()
        unique: List[Dict[str, Any]] = []
        for f in findings:
            key = (f.finding_text.strip(), f.provenance.get("page"))
            if key in seen:
                continue
            seen.add(key)
            unique.append(
                {
                    "finding_text": f.finding_text,
                    "severity": f.severity,
                    "recommended_action": f.recommended_action,
                    "amount": f.amount,
                    "fiscal_period": f.period,
                    "entity": f.entity,
                    "provenance": f.provenance,
                    "confidence": 0.6,  # heuristic baseline
                }
            )

        return unique


if __name__ == "__main__":  # Simple smoke test scaffold
    ap = AuditParser()
    example = {
        "extractor": "pdfplumber",
        "pages": [
            {
                "page_number": 1,
                "text": "County Government of Nairobi\nFinancial Year 2022/23\nFinding: Unsupported payment of KES 12,345,678 for procurement... Recommendation: Recover the amount.",
            }
        ],
        "tables": [],
    }
    meta = {
        "title": "Nairobi County – Audit Report FY 2022/23",
        "file_path": "sample.pdf",
    }
    out = ap.parse(example, meta)
    print(f"Parsed findings: {len(out)}")
