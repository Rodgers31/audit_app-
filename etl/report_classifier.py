"""
Report classifier for Parliament library documents.

Classifies DSpace items into ParliamentDocType categories based on
title patterns, collection membership, and metadata.  Also detects
Green Books and committee reports.

Designed to work with the output of ParliamentDSpaceClient and
EntityResolver.
"""

import logging
import re
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


# ── Classification patterns ─────────────────────────────────────────────────

# Audit reports from OAG
RE_AUDIT_REPORT = re.compile(
    r"(?:Report\s+(?:of\s+)?(?:the\s+)?(?:Controller\s+and\s+)?Auditor[- ]General|"
    r"Auditor[- ]General'?s?\s+Report|"
    r"Financial\s+Statements?\s+(?:of|for)|"
    r"Year\s+[Ee]nded?\s+(?:\d{1,2}(?:st|nd|rd|th)?\s+\w+\s*[,]?\s*)?\d{4})",
    re.IGNORECASE,
)

# Green Books / Consolidated county audit summaries
RE_GREEN_BOOK = re.compile(
    r"(?:Summary\s+(?:of\s+)?(?:Report|Audit)|"
    r"Consolidated\s+(?:Report|Audit)|"
    r"Green\s+Book|"
    r"County\s+Executives?\s+(?:and\s+)?(?:County\s+)?Assembl(?:y|ies)\s+(?:Summary|Consolidated))",
    re.IGNORECASE,
)

# Committee reports (CPAIC, PAC, PIC)
RE_COMMITTEE_REPORT = re.compile(
    r"(?:Report\s+of\s+(?:the\s+)?(?:Committee|CPAIC|PAC|PIC)|"
    r"(?:Public\s+(?:Accounts|Investments)\s+Committee)|"
    r"County\s+Public\s+Accounts\s+(?:and\s+Investments\s+)?Committee|"
    r"(?:Committee\s+on\s+(?:Public\s+)?(?:Accounts|Investments|Finance)))",
    re.IGNORECASE,
)

# Budget estimates / appropriation
RE_BUDGET_ESTIMATE = re.compile(
    r"(?:Budget\s+(?:Estimates?|Proposal|Statement)|"
    r"Appropriation\s+(?:Act|Bill)|"
    r"Division\s+of\s+Revenue|"
    r"County\s+Allocation\s+of\s+Revenue)",
    re.IGNORECASE,
)

# Hansard (parliamentary proceedings)
RE_HANSARD = re.compile(
    r"(?:Hansard|Official\s+Report\s+of\s+(?:the\s+)?(?:National\s+Assembly|Senate)|"
    r"Parliamentary\s+(?:Debates?|Proceedings))",
    re.IGNORECASE,
)

# Bills
RE_BILL = re.compile(
    r"(?:(?:The\s+)?(?:\w+\s+){0,5}Bill\s*,?\s*\d{4})",
    re.IGNORECASE,
)

# Acts
RE_ACT = re.compile(
    r"(?:(?:The\s+)?(?:\w+\s+){0,5}Act\s*,?\s*(?:No\.?\s*\d+\s+(?:of\s+)?)?\d{4})",
    re.IGNORECASE,
)

# Committee name extraction from committee reports
RE_COMMITTEE_NAME = re.compile(
    r"(?:Committee\s+on\s+[\w\s,]+|"
    r"(?:CPAIC|PAC|PIC|Public\s+Accounts\s+(?:and\s+Investments\s+)?Committee|"
    r"County\s+Public\s+Accounts\s+(?:and\s+Investments\s+)?Committee))",
    re.IGNORECASE,
)


@dataclass
class ClassificationResult:
    """Result of document classification."""

    doc_type: str  # One of ParliamentDocType values
    is_green_book: bool = False
    committee_name: Optional[str] = None
    confidence: float = 0.0
    matched_pattern: str = ""


class ReportClassifier:
    """Classify Parliament library documents by type.

    Usage:
        classifier = ReportClassifier()
        result = classifier.classify("Report of the Auditor-General on Nairobi City County Executive for FY 2021/22")
        # result.doc_type == "audit_report"
        # result.confidence == 0.90
    """

    def classify(
        self,
        title: str,
        collection_name: Optional[str] = None,
        subjects: Optional[list] = None,
    ) -> ClassificationResult:
        """Classify a document based on its title and optional metadata.

        Args:
            title: Document title string
            collection_name: DSpace collection name (if available)
            subjects: dc.subject metadata values (if available)

        Returns:
            ClassificationResult with doc_type and confidence.
        """
        title = (title or "").strip()
        if not title:
            return ClassificationResult(
                doc_type="other", confidence=0.0
            )

        # 1. Green Book (check before audit_report since it's a special case)
        if RE_GREEN_BOOK.search(title):
            return ClassificationResult(
                doc_type="green_book",
                is_green_book=True,
                confidence=0.90,
                matched_pattern="green_book",
            )

        # 2. Committee report
        m = RE_COMMITTEE_REPORT.search(title)
        if m:
            committee = self._extract_committee_name(title)
            return ClassificationResult(
                doc_type="committee_report",
                committee_name=committee,
                confidence=0.85,
                matched_pattern="committee_report",
            )

        # 3. Audit report (OAG)
        if RE_AUDIT_REPORT.search(title):
            return ClassificationResult(
                doc_type="audit_report",
                confidence=0.90,
                matched_pattern="audit_report",
            )

        # 4. Budget estimate / appropriation
        if RE_BUDGET_ESTIMATE.search(title):
            return ClassificationResult(
                doc_type="budget_estimate",
                confidence=0.80,
                matched_pattern="budget_estimate",
            )

        # 5. Hansard
        if RE_HANSARD.search(title):
            return ClassificationResult(
                doc_type="hansard",
                confidence=0.85,
                matched_pattern="hansard",
            )

        # 6. Bill
        if RE_BILL.search(title):
            return ClassificationResult(
                doc_type="bill",
                confidence=0.70,
                matched_pattern="bill",
            )

        # 7. Act
        if RE_ACT.search(title):
            return ClassificationResult(
                doc_type="act",
                confidence=0.70,
                matched_pattern="act",
            )

        # 8. Collection-based fallback
        if collection_name:
            coll_lower = collection_name.lower()
            if "audit" in coll_lower or "auditor" in coll_lower:
                return ClassificationResult(
                    doc_type="audit_report",
                    confidence=0.50,
                    matched_pattern="collection_fallback",
                )
            if "committee" in coll_lower:
                return ClassificationResult(
                    doc_type="committee_report",
                    confidence=0.50,
                    matched_pattern="collection_fallback",
                )
            if "budget" in coll_lower or "estimate" in coll_lower:
                return ClassificationResult(
                    doc_type="budget_estimate",
                    confidence=0.50,
                    matched_pattern="collection_fallback",
                )

        # 9. Subject-based fallback
        if subjects:
            subject_text = " ".join(str(s) for s in subjects).lower()
            if "audit" in subject_text:
                return ClassificationResult(
                    doc_type="audit_report",
                    confidence=0.40,
                    matched_pattern="subject_fallback",
                )

        # 10. Unclassified
        return ClassificationResult(
            doc_type="other",
            confidence=0.10,
            matched_pattern="none",
        )

    def _extract_committee_name(self, title: str) -> Optional[str]:
        """Extract committee name from a committee report title."""
        m = RE_COMMITTEE_NAME.search(title)
        return m.group(0).strip() if m else None
