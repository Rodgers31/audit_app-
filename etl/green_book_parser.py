"""
Green Book parser for county summary audit reports.

Green Books (formally "Summary of Audit Reports on County Executives" or
similar) are published by the Office of the Auditor-General and tabled in
Parliament.  They contain per-county tables with:

  - County name
  - Audit opinion (Unqualified / Qualified / Adverse / Disclaimer)
  - Queried amounts (irregular, unsupported, unaccounted-for expenditure)
  - Fiscal year

This parser extracts structured rows from Green Book PDFs using:
  1. pdfplumber table extraction (primary)
  2. Regex-based text fallback (when tables fail)

Usage:
    parser = GreenBookParser()
    results = parser.parse("path/to/green_book.pdf")
    for row in results.rows:
        print(row.county, row.audit_opinion, row.queried_amount)
"""

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Optional PDF extraction libs — fail gracefully
try:
    import pdfplumber

    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    pdfplumber = None  # type: ignore

# ── Known county names (47 counties) ──────────────────────────────────────
COUNTY_NAMES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Elgeyo Marakwet",
    "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega",
    "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu",
    "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni",
    "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
    "Muranga",  # alternate spelling
    "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
    "Nairobi", "Samburu", "Siaya", "Taita-Taveta", "Taita Taveta",
    "Tana River", "Tharaka-Nithi", "Tharaka Nithi", "Trans-Nzoia",
    "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir",
    "West Pokot",
]

# Build a lookup set for fast matching (lowercase)
_COUNTY_LOWER = {c.lower() for c in COUNTY_NAMES}

# Canonical names (normalise hyphens/spaces)
_COUNTY_CANONICAL = {}
for _c in COUNTY_NAMES:
    _key = _c.lower().replace("-", " ").replace("'", "")
    if _key not in _COUNTY_CANONICAL:
        _COUNTY_CANONICAL[_key] = _c

# Audit opinion keywords
OPINION_KEYWORDS = {
    "unqualified": "unqualified",
    "qualified": "qualified",
    "adverse": "adverse",
    "disclaimer": "disclaimer",
    "disclaimer of opinion": "disclaimer",
    "qualified opinion": "qualified",
    "unqualified opinion": "unqualified",
    "adverse opinion": "adverse",
}

# Amount patterns: "1,234,567" or "1,234,567.89" or "Kshs 1,234,567"
RE_AMOUNT = re.compile(
    r"(?:Kshs?\.?\s*|KES\s*|Ksh\s*)?"
    r"([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

# Fiscal year in text
RE_FY = re.compile(r"(?:FY\s*)?(\d{4})\s*/\s*(\d{2,4})", re.IGNORECASE)
RE_YEAR_ENDED = re.compile(
    r"(?:Year|Period)\s+[Ee]nded?\s+\d{1,2}\s+\w+[,\s]\s*(\d{4})",
    re.IGNORECASE,
)


@dataclass
class GreenBookRow:
    """A single county row extracted from a Green Book."""

    county: str
    audit_opinion: Optional[str] = None  # unqualified | qualified | adverse | disclaimer
    queried_amount: Optional[float] = None  # total queried amount in KES
    irregular_expenditure: Optional[float] = None
    unsupported_expenditure: Optional[float] = None
    unaccounted_expenditure: Optional[float] = None
    entity_type: str = "county_executive"  # county_executive | county_assembly
    fiscal_year: Optional[str] = None  # e.g. "2021/22"
    page_number: Optional[int] = None
    confidence: float = 0.0
    raw_text: str = ""


@dataclass
class GreenBookResult:
    """Result of parsing a Green Book PDF."""

    source_path: str
    fiscal_year: Optional[str] = None
    entity_scope: str = ""  # "County Executives" | "County Assemblies"
    rows: List[GreenBookRow] = field(default_factory=list)
    parse_method: str = ""  # "table" | "text" | "mixed"
    total_pages: int = 0
    pages_with_tables: int = 0
    warnings: List[str] = field(default_factory=list)

    @property
    def county_count(self) -> int:
        return len({r.county.lower() for r in self.rows})


class GreenBookParser:
    """Extract county-level audit data from Green Book PDFs.

    Strategy:
      1. Try pdfplumber table extraction on each page
      2. For pages where tables fail, fall back to regex text parsing
      3. Deduplicate rows by county name within a result set
      4. All parsing is local and read-only
    """

    def __init__(self):
        if not HAS_PDFPLUMBER:
            logger.warning(
                "pdfplumber not installed — Green Book parsing will use text-only fallback"
            )

    def parse(self, pdf_path: str) -> GreenBookResult:
        """Parse a Green Book PDF and return structured rows.

        Args:
            pdf_path: Path to the PDF file.

        Returns:
            GreenBookResult with extracted rows.
        """
        path = Path(pdf_path)
        if not path.exists():
            logger.error("File not found: %s", pdf_path)
            return GreenBookResult(source_path=pdf_path, warnings=["File not found"])

        result = GreenBookResult(source_path=str(path))

        if HAS_PDFPLUMBER:
            result = self._parse_with_pdfplumber(path, result)
        else:
            result.warnings.append("pdfplumber not available — text fallback only")

        # Deduplicate rows by county (keep highest confidence)
        result.rows = self._deduplicate_rows(result.rows)

        # Try to infer fiscal year from title pages if not yet set
        if not result.fiscal_year and result.rows:
            fy_candidates = [r.fiscal_year for r in result.rows if r.fiscal_year]
            if fy_candidates:
                result.fiscal_year = max(set(fy_candidates), key=fy_candidates.count)

        return result

    def _parse_with_pdfplumber(
        self, path: Path, result: GreenBookResult
    ) -> GreenBookResult:
        """Primary parsing path using pdfplumber."""
        try:
            with pdfplumber.open(str(path)) as pdf:
                result.total_pages = len(pdf.pages)

                # Extract fiscal year and scope from first few pages
                for page in pdf.pages[:5]:
                    text = page.extract_text() or ""
                    if not result.fiscal_year:
                        fy = self._extract_fiscal_year(text)
                        if fy:
                            result.fiscal_year = fy
                    if not result.entity_scope:
                        scope = self._detect_scope(text)
                        if scope:
                            result.entity_scope = scope
                    if result.fiscal_year and result.entity_scope:
                        break

                # Process all pages for tables
                for page_num, page in enumerate(pdf.pages, 1):
                    tables = page.extract_tables()
                    if tables:
                        result.pages_with_tables += 1
                        for table in tables:
                            rows = self._parse_table(
                                table,
                                page_number=page_num,
                                fiscal_year=result.fiscal_year,
                                entity_scope=result.entity_scope,
                            )
                            result.rows.extend(rows)
                            if rows:
                                result.parse_method = (
                                    "table"
                                    if result.parse_method != "text"
                                    else "mixed"
                                )
                    else:
                        # Fallback: text extraction
                        text = page.extract_text() or ""
                        rows = self._parse_text(
                            text,
                            page_number=page_num,
                            fiscal_year=result.fiscal_year,
                            entity_scope=result.entity_scope,
                        )
                        if rows:
                            result.rows.extend(rows)
                            result.parse_method = (
                                "text"
                                if result.parse_method != "table"
                                else "mixed"
                            )

        except Exception as e:
            logger.error("pdfplumber failed on %s: %s", path, e)
            result.warnings.append(f"pdfplumber error: {e}")

        if not result.parse_method:
            result.parse_method = "none"

        return result

    def _parse_table(
        self,
        table: List[List[Optional[str]]],
        page_number: int,
        fiscal_year: Optional[str],
        entity_scope: str,
    ) -> List[GreenBookRow]:
        """Parse a single extracted table into GreenBookRows.

        Green Book tables typically have columns like:
          No. | County | Opinion | Queried Amount | Irregular | Unsupported | ...

        The column headers vary across editions, so we detect columns
        by header keywords.
        """
        if not table or len(table) < 2:
            return []

        # Step 1: Identify column mapping from header row
        header_row = table[0]
        col_map = self._identify_columns(header_row)

        if "county" not in col_map:
            # Try second row as header (some tables have merged title row)
            if len(table) > 2:
                col_map = self._identify_columns(table[1])
                data_rows = table[2:]
            else:
                return []
        else:
            data_rows = table[1:]

        if "county" not in col_map:
            return []

        # Step 2: Extract data rows
        rows = []
        for raw_row in data_rows:
            if not raw_row or all(not cell for cell in raw_row):
                continue

            county_idx = col_map["county"]
            if county_idx >= len(raw_row):
                continue

            county_cell = (raw_row[county_idx] or "").strip()
            county = self._match_county(county_cell)
            if not county:
                continue

            row = GreenBookRow(
                county=county,
                page_number=page_number,
                fiscal_year=fiscal_year,
                confidence=0.80,
                raw_text=str(raw_row),
            )

            # Entity scope
            if entity_scope:
                row.entity_type = (
                    "county_assembly"
                    if "assembl" in entity_scope.lower()
                    else "county_executive"
                )

            # Opinion
            if "opinion" in col_map:
                idx = col_map["opinion"]
                if idx < len(raw_row):
                    opinion_text = (raw_row[idx] or "").strip().lower()
                    for kw, canonical in OPINION_KEYWORDS.items():
                        if kw in opinion_text:
                            row.audit_opinion = canonical
                            row.confidence = 0.85
                            break

            # Queried / total amount
            if "queried" in col_map:
                row.queried_amount = self._parse_amount(
                    raw_row, col_map["queried"]
                )

            # Irregular expenditure
            if "irregular" in col_map:
                row.irregular_expenditure = self._parse_amount(
                    raw_row, col_map["irregular"]
                )

            # Unsupported expenditure
            if "unsupported" in col_map:
                row.unsupported_expenditure = self._parse_amount(
                    raw_row, col_map["unsupported"]
                )

            # Unaccounted expenditure
            if "unaccounted" in col_map:
                row.unaccounted_expenditure = self._parse_amount(
                    raw_row, col_map["unaccounted"]
                )

            rows.append(row)

        return rows

    def _identify_columns(
        self, header: List[Optional[str]]
    ) -> Dict[str, int]:
        """Map header cell text to column indices.

        Looks for keywords like "county", "opinion", "queried", "irregular", etc.
        """
        col_map = {}
        for idx, cell in enumerate(header or []):
            if not cell:
                continue
            lower = cell.strip().lower()

            if any(kw in lower for kw in ("county", "entity", "name")):
                col_map.setdefault("county", idx)
            elif any(kw in lower for kw in ("opinion", "audit opinion", "type of opinion")):
                col_map.setdefault("opinion", idx)
            elif any(kw in lower for kw in ("queried", "total queried", "queried amount")):
                col_map.setdefault("queried", idx)
            elif "irregular" in lower:
                col_map.setdefault("irregular", idx)
            elif "unsupported" in lower:
                col_map.setdefault("unsupported", idx)
            elif any(kw in lower for kw in ("unaccounted", "un-accounted")):
                col_map.setdefault("unaccounted", idx)
            elif any(kw in lower for kw in ("no.", "s/no", "sn", "#")):
                pass  # row number column — skip

        return col_map

    def _parse_text(
        self,
        text: str,
        page_number: int,
        fiscal_year: Optional[str],
        entity_scope: str,
    ) -> List[GreenBookRow]:
        """Fallback: extract county rows from raw text using regex.

        Looks for lines containing a county name followed by an opinion keyword
        and/or amounts.
        """
        rows = []
        if not text:
            return rows

        lines = text.split("\n")
        for line in lines:
            line_stripped = line.strip()
            if not line_stripped or len(line_stripped) < 5:
                continue

            # Try to find a county name in the line
            county = self._match_county_in_line(line_stripped)
            if not county:
                continue

            row = GreenBookRow(
                county=county,
                page_number=page_number,
                fiscal_year=fiscal_year,
                confidence=0.50,  # lower confidence for text extraction
                raw_text=line_stripped[:200],
            )

            if entity_scope:
                row.entity_type = (
                    "county_assembly"
                    if "assembl" in entity_scope.lower()
                    else "county_executive"
                )

            # Try to find opinion keyword
            lower = line_stripped.lower()
            for kw, canonical in OPINION_KEYWORDS.items():
                if kw in lower:
                    row.audit_opinion = canonical
                    row.confidence = 0.60
                    break

            # Try to extract amounts
            amounts = RE_AMOUNT.findall(line_stripped)
            parsed_amounts = []
            for a in amounts:
                val = self._clean_amount(a)
                if val is not None and val > 0:
                    parsed_amounts.append(val)

            if parsed_amounts:
                # First large amount is likely the queried/total
                row.queried_amount = max(parsed_amounts)
                row.confidence = min(row.confidence + 0.10, 0.70)

            rows.append(row)

        return rows

    def _match_county(self, text: str) -> Optional[str]:
        """Match a cell value to a known county name."""
        if not text:
            return None
        # Direct match
        cleaned = text.strip().rstrip(".")
        lower = cleaned.lower().replace("-", " ").replace("'", "")
        if lower in _COUNTY_CANONICAL:
            return _COUNTY_CANONICAL[lower]
        # Prefix match (e.g. "Nairobi City" → "Nairobi")
        for cname_lower, canonical in _COUNTY_CANONICAL.items():
            if lower.startswith(cname_lower) or cname_lower.startswith(lower):
                return canonical
        return None

    def _match_county_in_line(self, line: str) -> Optional[str]:
        """Find first county name mentioned in a text line."""
        lower = line.lower()
        for cname_lower, canonical in sorted(
            _COUNTY_CANONICAL.items(), key=lambda x: len(x[0]), reverse=True
        ):
            if cname_lower in lower:
                return canonical
        return None

    def _parse_amount(
        self, row: List[Optional[str]], col_idx: int
    ) -> Optional[float]:
        """Extract a numeric amount from a table cell."""
        if col_idx >= len(row):
            return None
        cell = row[col_idx]
        if not cell:
            return None
        return self._clean_amount(cell.strip())

    def _clean_amount(self, text: str) -> Optional[float]:
        """Parse a formatted number like '1,234,567.89' into a float."""
        if not text:
            return None
        # Remove currency prefix/suffix
        cleaned = re.sub(r"[^\d,.]", "", text)
        if not cleaned:
            return None
        # Remove commas
        cleaned = cleaned.replace(",", "")
        try:
            val = float(cleaned)
            # Sanity: skip obviously wrong values (e.g. page numbers)
            if val < 100:
                return None
            return val
        except (ValueError, OverflowError):
            return None

    def _extract_fiscal_year(self, text: str) -> Optional[str]:
        """Extract fiscal year from page text."""
        m = RE_FY.search(text)
        if m:
            start = m.group(1)
            end = m.group(2)
            if len(end) == 4:
                end = end[2:]
            return f"{start}/{end}"

        m = RE_YEAR_ENDED.search(text)
        if m:
            end_year = int(m.group(1))
            return f"{end_year - 1}/{str(end_year)[2:]}"

        return None

    def _detect_scope(self, text: str) -> str:
        """Detect whether the Green Book covers executives or assemblies."""
        lower = (text or "").lower()
        if "county executive" in lower:
            return "County Executives"
        if "county assembl" in lower:
            return "County Assemblies"
        return ""

    def _deduplicate_rows(self, rows: List[GreenBookRow]) -> List[GreenBookRow]:
        """Keep the highest-confidence row per county + entity_type combo."""
        best: Dict[str, GreenBookRow] = {}
        for row in rows:
            key = f"{row.county.lower()}|{row.entity_type}"
            existing = best.get(key)
            if existing is None or row.confidence > existing.confidence:
                best[key] = row
        return list(best.values())


# ── CLI entry point ───────────────────────────────────────────────────────

def main():
    """Parse a Green Book PDF from the command line."""
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Green Book PDF Parser")
    parser.add_argument("pdf_path", help="Path to Green Book PDF")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    gb_parser = GreenBookParser()
    result = gb_parser.parse(args.pdf_path)

    if args.json:
        output = {
            "source_path": result.source_path,
            "fiscal_year": result.fiscal_year,
            "entity_scope": result.entity_scope,
            "parse_method": result.parse_method,
            "total_pages": result.total_pages,
            "county_count": result.county_count,
            "warnings": result.warnings,
            "rows": [
                {
                    "county": r.county,
                    "audit_opinion": r.audit_opinion,
                    "queried_amount": r.queried_amount,
                    "irregular_expenditure": r.irregular_expenditure,
                    "unsupported_expenditure": r.unsupported_expenditure,
                    "unaccounted_expenditure": r.unaccounted_expenditure,
                    "entity_type": r.entity_type,
                    "fiscal_year": r.fiscal_year,
                    "page_number": r.page_number,
                    "confidence": r.confidence,
                }
                for r in result.rows
            ],
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"Source: {result.source_path}")
        print(f"Fiscal Year: {result.fiscal_year or 'unknown'}")
        print(f"Scope: {result.entity_scope or 'unknown'}")
        print(f"Method: {result.parse_method}")
        print(f"Pages: {result.total_pages} ({result.pages_with_tables} with tables)")
        print(f"Counties found: {result.county_count}")
        print(f"Warnings: {len(result.warnings)}")
        print()
        for row in sorted(result.rows, key=lambda r: r.county):
            opinion = row.audit_opinion or "?"
            amount = (
                f"KES {row.queried_amount:,.0f}" if row.queried_amount else "—"
            )
            print(f"  {row.county:25s} {opinion:15s} {amount:>20s}  (p.{row.page_number}, conf={row.confidence:.2f})")


if __name__ == "__main__":
    main()
