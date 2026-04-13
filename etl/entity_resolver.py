"""
Entity resolver for audit report titles and document metadata.

Given a document title string (e.g. from DSpace or OAG), this module
extracts:
  - Entity type and name (county, ministry, state corporation, etc.)
  - Fiscal year(s)
  - Audit opinion (if embedded in title)
  - Confidence score for the resolution

Example titles from Parliament library:
  "Report of the Auditor-General on Nairobi City County Executive for FY 2021/22"
  "Report of the Auditor-General on Kenya National Highways Authority for FY 2020/21"
  "Report on the Financial Statements of the Judiciary for FY 2022/23"
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class ResolvedEntity:
    """Result of entity resolution from a document title."""

    entity_name: str
    entity_type: str  # county | ministry | agency | state_corporation | educational_institution | fund | judiciary | commission | national | constituency
    fiscal_years: List[str] = field(default_factory=list)  # e.g. ["2021/22"]
    audit_opinion: Optional[str] = (
        None  # unqualified | qualified | adverse | disclaimer
    )
    is_green_book: bool = False
    confidence: float = 0.0
    raw_match: str = ""


# ── Kenya's 47 county names for matching ───────────────────────────────────

COUNTY_NAMES = [
    "Baringo",
    "Bomet",
    "Bungoma",
    "Busia",
    "Elgeyo-Marakwet",
    "Embu",
    "Garissa",
    "Homa Bay",
    "Isiolo",
    "Kajiado",
    "Kakamega",
    "Kericho",
    "Kiambu",
    "Kilifi",
    "Kirinyaga",
    "Kisii",
    "Kisumu",
    "Kitui",
    "Kwale",
    "Laikipia",
    "Lamu",
    "Machakos",
    "Makueni",
    "Mandera",
    "Marsabit",
    "Meru",
    "Migori",
    "Mombasa",
    "Murang'a",
    "Nairobi",
    "Nakuru",
    "Nandi",
    "Narok",
    "Nyamira",
    "Nyandarua",
    "Nyeri",
    "Samburu",
    "Siaya",
    "Taita-Taveta",
    "Tana River",
    "Tharaka-Nithi",
    "Trans-Nzoia",
    "Turkana",
    "Uasin Gishu",
    "Vihiga",
    "Wajir",
    "West Pokot",
]

# Build a regex alternation for counties (case-insensitive)
_county_alt = "|".join(
    re.escape(c) for c in sorted(COUNTY_NAMES, key=len, reverse=True)
)

# ── Title patterns (ordered by specificity) ────────────────────────────────

# Pattern: "...on {County} County Executive..." or "{County} County Assembly..."
RE_COUNTY = re.compile(
    rf"(?:on\s+(?:the\s+)?)?({_county_alt})\s+(?:City\s+)?County\s+"
    r"(?:Executive|Assembly|Government|Municipality|Fund|Revenue\s+Fund|"
    r"Water\s+(?:and\s+Sewerage\s+)?Company|Level\s+\d)",
    re.IGNORECASE,
)

# Pattern: Green Book / consolidated report (county-level or national government summary)
RE_GREEN_BOOK = re.compile(
    r"(?:Summary|Consolidated)\s+(?:of\s+)?(?:\w+\s+)?(?:Reports?|Audits?)\s+(?:on|of)\s+.*?"
    r"(?:County\s+(?:Executive|Assembl)|Counties|National\s+Government)",
    re.IGNORECASE,
)

# Pattern: Ministry / State Department
RE_MINISTRY = re.compile(
    r"(?:on\s+(?:the\s+)?)?(Ministry\s+of|State\s+Department\s+(?:of|for))\s+"
    r"(.+?)(?:\s+for\s+(?:the\s+)?(?:FY|Financial|Year)|\s*$)",
    re.IGNORECASE,
)

# Pattern: State Corporation / Authority / Board / Institute / Company / etc.
# Handles "on (the)? (Financial Statements? of (the)?)? <entity> (of X)? ((ABBR))? for|$"
# Keywords cover: state corps, universities, schools, TVET colleges, museums,
# government departments/secretariats, special programmes/projects, treasury
RE_STATE_CORP = re.compile(
    r"(?:on\s+(?:the\s+)?(?:Financial\s+Statements?\s+(?:of\s+(?:the\s+)?)?)?)"
    r"((?:Kenya\s+)?[\w\s\-'.]{0,80}?"
    r"(?:Authority|Corporation|Board|Institute|Agency|Commission|Service|Council|Fund"
    r"|Company(?:\s+(?:PLC|Ltd|Limited))?|Centre|Bureau|Polytechnic"
    r"|University(?:\s+College)?|College"
    r"|Hospital|SACCO|Society|Trust|Office|Scheme"
    r"|(?:Secondary|Primary|Technical|High|Girls|Boys)?\s*School"
    r"|Secretariat|Museums?|Treasury|Department"
    r"|Program(?:me)?|Project)"
    r"(?:\s+of\s+[\w\-']+(?:\s+[\w\-']+){0,4})?"
    r"(?:\s+(?:Grant|Credit|Loan)\s+(?:No\.?|Number)\s*[\w\-]+)?"
    r"(?:\s*\([\w\s\-]{2,30}\))?)"
    r"(?:\s+for\s+|\s+for$|\s+year\s+|\s*$)",
    re.IGNORECASE,
)

# Pattern: Judiciary
RE_JUDICIARY = re.compile(
    r"(?:on\s+(?:the\s+)?)?(?:Financial\s+Statements?\s+of\s+(?:the\s+)?)?Judiciary",
    re.IGNORECASE,
)

# Pattern: Constituency Development Fund
RE_CONSTITUENCY = re.compile(
    r"(?:National\s+Government\s+)?Constituencies?\s+Development\s+Fund"
    r"(?:\s*[-–]\s*(.+?)(?:\s+Constituency)?)?"
    r"(?:\s+for\s+|\s*$)",
    re.IGNORECASE,
)

# Pattern: National Assembly / Senate / Parliamentary Service Commission
RE_PARLIAMENT = re.compile(
    r"(?:National\s+Assembly|Senate|Parliamentary\s+Service\s+Commission)",
    re.IGNORECASE,
)

# Fiscal year extraction: "FY 2021/22" or "FY2021/2022" or "Year ended 30 June 2022"
RE_FISCAL_YEAR = re.compile(
    r"(?:FY\s*)?(\d{4})\s*/\s*(\d{2,4})",
    re.IGNORECASE,
)
# "Year Ended 30 June 2022" or "Year Ended 30 June,2024" (comma variant)
# Also: "Year Ended 30th June 2022" (ordinal day), "year Ended 2024" (bare year)
RE_YEAR_ENDED = re.compile(
    r"(?:Year|Period)\s+[Ee]nded?\s+(?:\d{1,2}(?:st|nd|rd|th)?\s+\w+[,\s]\s*)?(\d{4})",
    re.IGNORECASE,
)
# "Year 2021-2022" or "Year 2021/2022"
RE_YEAR_RANGE = re.compile(
    r"(?:for\s+(?:the\s+)?)?Year\s+(\d{4})\s*[-/]\s*(\d{4})",
    re.IGNORECASE,
)

# Audit opinion patterns in titles
RE_OPINION = re.compile(
    r"\b(Disclaimer|Adverse|Qualified|Unqualified)\b",
    re.IGNORECASE,
)


class EntityResolver:
    """Resolve entity + fiscal year + opinion from document titles.

    Usage:
        resolver = EntityResolver()
        result = resolver.resolve("Report of the Auditor-General on Nairobi City County Executive for FY 2021/22")
        # result.entity_name == "Nairobi"
        # result.entity_type == "county"
        # result.fiscal_years == ["2021/22"]
    """

    def __init__(self, extra_county_names: Optional[List[str]] = None):
        self._extra_counties = extra_county_names or []

    def resolve(self, title: str) -> ResolvedEntity:
        """Attempt to resolve an entity from a document title.

        Returns a ResolvedEntity with confidence score.
        Higher confidence = more specific match.
        """
        title = title.strip()
        if not title:
            return ResolvedEntity(
                entity_name="",
                entity_type="unknown",
                confidence=0.0,
            )

        # Extract fiscal years first (used across all entity types)
        fiscal_years = self._extract_fiscal_years(title)

        # Extract audit opinion if present
        opinion = self._extract_opinion(title)

        # Try patterns in order of specificity

        # 1. Green Book / Consolidated (county or national government summary)
        if RE_GREEN_BOOK.search(title):
            is_national_gov = bool(
                re.search(r"National\s+Government", title, re.IGNORECASE)
            )
            name = (
                "Consolidated National Government Report"
                if is_national_gov
                else "Consolidated County Report"
            )
            return ResolvedEntity(
                entity_name=name,
                entity_type="national",
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                is_green_book=True,
                confidence=0.85,
                raw_match=title,
            )

        # 2. County entity
        m = RE_COUNTY.search(title)
        if m:
            county_name = m.group(1).strip()
            return ResolvedEntity(
                entity_name=county_name,
                entity_type="county",
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                confidence=0.90,
                raw_match=m.group(0),
            )

        # 3. Constituency Development Fund
        m = RE_CONSTITUENCY.search(title)
        if m:
            cname = (
                (m.group(1) or "").strip() if m.lastindex and m.lastindex >= 1 else ""
            )
            return ResolvedEntity(
                entity_name=cname or "Constituency Development Fund",
                entity_type="constituency",
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                confidence=0.85,
                raw_match=m.group(0),
            )

        # 4. Judiciary
        if RE_JUDICIARY.search(title):
            return ResolvedEntity(
                entity_name="Judiciary",
                entity_type="judiciary",
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                confidence=0.90,
                raw_match="Judiciary",
            )

        # 5. Parliament bodies
        m = RE_PARLIAMENT.search(title)
        if m:
            return ResolvedEntity(
                entity_name=m.group(0).strip(),
                entity_type="national",
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                confidence=0.85,
                raw_match=m.group(0),
            )

        # 5b. National Government aggregated reports (MDAs)
        if re.search(
            r"(?:National\s+Government\s+)?Ministries?,?\s+Departments?\s+and\s+Agencies?",
            title,
            re.IGNORECASE,
        ):
            return ResolvedEntity(
                entity_name="National Government MDAs",
                entity_type="national",
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                confidence=0.80,
                raw_match=title[:100],
            )

        # 6. Ministry / State Department
        m = RE_MINISTRY.search(title)
        if m:
            prefix = m.group(1).strip()  # "Ministry of" or "State Department for"
            dept = self._clean_entity_name(m.group(2).strip())
            return ResolvedEntity(
                entity_name=f"{prefix} {dept}",
                entity_type="ministry",
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                confidence=0.85,
                raw_match=m.group(0),
            )

        # 7. State corporation / authority / board / fund / programme / department
        m = RE_STATE_CORP.search(title)
        if m:
            name = self._clean_entity_name(m.group(1).strip())
            if self._is_usable_entity_name(name):
                # Determine sub-type from suffix
                lower = name.lower()
                if any(w in lower for w in ("commission",)):
                    etype = "commission"
                elif any(w in lower for w in ("fund",)):
                    etype = "fund"
                elif any(
                    w in lower for w in ("programme", "program", "project", "grant")
                ):
                    etype = "fund"  # donor-funded programmes grouped with funds
                elif any(
                    w in lower
                    for w in ("treasury", "department", "secretariat", "museum")
                ):
                    etype = "national"  # national government entities
                elif any(
                    w in lower
                    for w in ("school", "polytechnic", "university", "college")
                ):
                    etype = "educational_institution"
                else:
                    etype = "state_corporation"
                return ResolvedEntity(
                    entity_name=name,
                    entity_type=etype,
                    fiscal_years=fiscal_years,
                    audit_opinion=opinion,
                    confidence=0.70,
                    raw_match=m.group(0),
                )

        # 8. Fallback: titles without "Report of the Auditor-General on" prefix
        #    but containing a known entity keyword (e.g., legacy DSpace entries)
        m_legacy = re.search(
            r"([\w\s\-'.]{3,80}?"
            r"(?:Authority|Corporation|Board|Institute|Agency|Commission|Service|Council|Fund"
            r"|Company|Centre|Bureau|Polytechnic|University|College|Hospital|School"
            r"|Secretariat|Museums?|Treasury|Department|Program(?:me)?|Project))"
            r"(?:\s*[-–]\s*|\s+for\s+|\s+year\s+|\s*$)",
            title,
            re.IGNORECASE,
        )
        if m_legacy:
            name = self._clean_entity_name(m_legacy.group(1).strip())
            if self._is_usable_entity_name(name):
                lower = name.lower()
                if any(w in lower for w in ("commission",)):
                    etype = "commission"
                elif any(w in lower for w in ("fund",)):
                    etype = "fund"
                elif any(
                    w in lower
                    for w in ("school", "polytechnic", "university", "college")
                ):
                    etype = "educational_institution"
                else:
                    etype = "state_corporation"
                return ResolvedEntity(
                    entity_name=name,
                    entity_type=etype,
                    fiscal_years=fiscal_years,
                    audit_opinion=opinion,
                    confidence=0.50,
                    raw_match=m_legacy.group(0),
                )

        # 8b. Title-based extraction: strip "Report of the Auditor-General on"
        #     prefix and use the remaining text as entity name.
        #     Handles statement-style titles, schools, projects, etc.
        m_title = re.match(
            r"(?:Special\s+Audit\s+)?Report\s+(?:of|Of)\s+(?:the|The)\s+"
            r"Auditor[\s-]*General(?:'s)?\s+on\s+(?:the\s+)?"
            r"(?:Financial\s+Statements?\s+(?:of\s+(?:the\s+)?)?)?(.+)",
            title,
            re.IGNORECASE,
        )
        if m_title:
            name = m_title.group(1).strip()
            # Strip trailing year / FY clause
            name = re.sub(
                r"\s+for\s+(?:the\s+)?(?:Year|FY|Period|Financial).*$",
                "",
                name,
                flags=re.IGNORECASE,
            ).strip()
            name = re.sub(r"\s+[Yy]ear\s+[Ee]nded.*$", "", name).strip()
            name = self._clean_entity_name(name)
            # Cap at 120 chars
            name = name[:120]
            # Classify sub-type
            lower = name.lower()
            if any(w in lower for w in ("revenue", "consolidated fund", "statement")):
                etype = "national"
            elif any(w in lower for w in ("commission",)):
                etype = "commission"
            elif any(w in lower for w in ("fund", "grant", "credit", "loan")):
                etype = "fund"
            elif any(w in lower for w in ("programme", "program", "project")):
                etype = "fund"
            elif any(w in lower for w in ("ministry", "department", "secretariat")):
                etype = "national"
            elif any(
                w in lower for w in ("school", "polytechnic", "university", "college")
            ):
                etype = "educational_institution"
            else:
                etype = "state_corporation"
            return ResolvedEntity(
                entity_name=name,
                entity_type=etype,
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                confidence=0.40,
                raw_match=title[:120],
            )

        # 8c. Summary / Management Letter / Performance Audit fallback
        m_summary = re.match(
            r"(?:Office\s+of\s+the\s+)?Auditor[\s-]*General(?:'?s)?\s+"
            r"(.+?)(?:\s+for\s+(?:the\s+)?(?:Year|FY|Period).*)?$",
            title,
            re.IGNORECASE,
        )
        if m_summary:
            name = self._clean_entity_name(m_summary.group(1).strip())
            name = re.sub(
                r"\s+for\s+(?:the\s+)?(?:Year|FY|Period|Financial).*$",
                "",
                name,
                flags=re.IGNORECASE,
            ).strip()
            name = name[:120]
            return ResolvedEntity(
                entity_name=name,
                entity_type="national",
                fiscal_years=fiscal_years,
                audit_opinion=opinion,
                confidence=0.35,
                raw_match=title[:120],
            )

        # 9. Fallback: unresolved
        return ResolvedEntity(
            entity_name=title[:120],
            entity_type="unknown",
            fiscal_years=fiscal_years,
            audit_opinion=opinion,
            confidence=0.20,
            raw_match=title,
        )

    @staticmethod
    def _clean_entity_name(name: str) -> str:
        """Strip trailing preposition artifacts from extracted entity names."""
        # Remove trailing "for the", "for the Year Ended ...", "for Year"
        name = re.sub(
            r"\s+for\s+(?:the\s*)?(?:Year\s+)?(?:Ended?\b.*)?$",
            "",
            name,
            flags=re.IGNORECASE,
        ).strip()
        name = re.sub(
            r"\s+of\s+the\s*$",
            "",
            name,
            flags=re.IGNORECASE,
        ).strip()
        # Strip trailing punctuation and whitespace
        name = re.sub(r"[\s.,;:]+$", "", name)
        # Strip leaked "Report of the Auditor-General on [the]" prefix
        name = re.sub(
            r"^(?:Special\s+Audit\s+)?Report\s+(?:of|Of)\s+(?:the|The)\s+"
            r"Auditor[\s\-]*General(?:'s)?\s+on\s+(?:the\s+)?",
            "",
            name,
            flags=re.IGNORECASE,
        ).strip()
        # Collapse multiple spaces
        name = re.sub(r"\s{2,}", " ", name)
        return name

    _GENERIC_KEYWORDS = frozenset(
        {
            "authority",
            "corporation",
            "board",
            "institute",
            "agency",
            "commission",
            "service",
            "council",
            "fund",
            "company",
            "company limited",
            "company ltd",
            "company plc",
            "centre",
            "center",
            "bureau",
            "polytechnic",
            "university",
            "college",
            "hospital",
            "sacco",
            "society",
            "trust",
            "office",
            "scheme",
            "school",
            "secretariat",
            "museum",
            "museums",
            "treasury",
            "department",
            "programme",
            "program",
            "project",
            "account",
            "lands limited",
            "national alliance",
            "transport and safety",
        }
    )

    @staticmethod
    def _is_usable_entity_name(name: str) -> bool:
        """Check if an extracted entity name is specific enough to use."""
        if not name or len(name) <= 2:
            return False
        if re.match(r"^\d+$", name):
            return False
        # Reject mid-word fragments (starts with lowercase = captured mid-word)
        if name[0].islower():
            return False
        if name.lower().strip() in EntityResolver._GENERIC_KEYWORDS:
            return False
        return True

    def resolve_batch(self, titles: List[str]) -> List[ResolvedEntity]:
        """Resolve a batch of titles."""
        return [self.resolve(t) for t in titles]

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _extract_fiscal_years(self, title: str) -> List[str]:
        """Extract fiscal year labels like '2021/22' from title."""
        results = []

        # 1. Explicit FY: "FY 2021/22"
        for m in RE_FISCAL_YEAR.finditer(title):
            start_year = m.group(1)
            end_part = m.group(2)
            # Normalise to YYYY/YY format
            if len(end_part) == 4:
                end_part = end_part[2:]
            label = f"{start_year}/{end_part}"
            if label not in results:
                results.append(label)

        # 2. "Year Ended 30 June 2022" or "Year Ended 30 June,2024"
        if not results:
            for m in RE_YEAR_ENDED.finditer(title):
                end_year = int(m.group(1))
                start_year = end_year - 1
                label = f"{start_year}/{str(end_year)[2:]}"
                if label not in results:
                    results.append(label)

        # 3. "Year 2021-2022" or "Year 2021/2022" (full-year range)
        if not results:
            for m in RE_YEAR_RANGE.finditer(title):
                start_year = m.group(1)
                end_year = m.group(2)
                label = f"{start_year}/{end_year[2:]}"
                if label not in results:
                    results.append(label)

        return results

    def _extract_opinion(self, title: str) -> Optional[str]:
        """Extract audit opinion keyword from title if present."""
        m = RE_OPINION.search(title)
        if m:
            return m.group(1).lower()
        return None
