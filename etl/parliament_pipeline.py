"""
Parliament library ingestion pipeline.

Connects to the Kenya Parliament DSpace 7 digital library, discovers
Auditor-General reports (and optionally committee reports), classifies
them, resolves entities, and loads metadata into AuditGava's database.

This pipeline is designed to be safe by default:
  - Disabled unless explicitly enabled via PARLIAMENT_PIPELINE_ENABLED=1
  - Runs in dry-run mode unless --commit is passed
  - Logs all actions for audit trail
  - Deduplicates on dspace_uuid before inserting

Usage (CLI):
    python -m etl.parliament_pipeline --dry-run
    PARLIAMENT_PIPELINE_ENABLED=1 python -m etl.parliament_pipeline --commit

Integration with existing pipeline:
    from etl.parliament_pipeline import ParliamentPipeline
    pipeline = ParliamentPipeline(db_session=session)
    stats = pipeline.run(dry_run=True)
"""

import argparse
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

# Conditional imports — graceful fallback if DB is not configured
try:
    _be = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
    if _be not in sys.path:
        sys.path.append(_be)
    from models import (
        AuditOpinion,
        Base,
        DocumentStatus,
        DocumentType,
        ParliamentDocType,
        ParliamentSourceDocument,
        SourceDocument,
    )
except ImportError:
    logger.warning("Backend models not importable — running in metadata-only mode")
    AuditOpinion = None
    Base = None
    DocumentStatus = None
    DocumentType = None
    ParliamentDocType = None
    ParliamentSourceDocument = None
    SourceDocument = None

try:
    from .entity_resolver import EntityResolver
except ImportError:
    from entity_resolver import EntityResolver

try:
    from .parliament_dspace_client import (
        AUDITOR_GENERAL_COMMUNITY,
        AUDITOR_GENERAL_SUBCOMMUNITY,
        COLLECTION_CONSTITUENCIES_AG,
        NATIONAL_ASSEMBLY_COMMUNITY,
        BitstreamInfo,
        DSpaceItem,
        ParliamentDSpaceClient,
    )
except ImportError:
    from parliament_dspace_client import (
        AUDITOR_GENERAL_COMMUNITY,
        AUDITOR_GENERAL_SUBCOMMUNITY,
        COLLECTION_CONSTITUENCIES_AG,
        NATIONAL_ASSEMBLY_COMMUNITY,
        BitstreamInfo,
        DSpaceItem,
        ParliamentDSpaceClient,
    )

try:
    from .report_classifier import ReportClassifier
except ImportError:
    from report_classifier import ReportClassifier


@dataclass
class PipelineStats:
    """Accumulator for pipeline run statistics."""

    items_discovered: int = 0
    items_classified: int = 0
    items_resolved: int = 0
    items_inserted: int = 0
    items_skipped_duplicate: int = 0
    items_skipped_low_confidence: int = 0
    pdfs_downloaded: int = 0
    pdfs_skipped: int = 0
    pdfs_failed: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"Parliament pipeline: "
            f"discovered={self.items_discovered}, "
            f"classified={self.items_classified}, "
            f"resolved={self.items_resolved}, "
            f"inserted={self.items_inserted}, "
            f"skipped_dup={self.items_skipped_duplicate}, "
            f"skipped_lowconf={self.items_skipped_low_confidence}, "
            f"pdfs_downloaded={self.pdfs_downloaded}, "
            f"pdfs_skipped={self.pdfs_skipped}, "
            f"pdfs_failed={self.pdfs_failed}, "
            f"errors={len(self.errors)}"
        )


class ParliamentPipeline:
    """Orchestrates the Parliament library ingestion flow.

    Steps:
      1. Discover items from DSpace (Auditor-General community)
      2. Classify each item (audit report / committee / green book / etc.)
      3. Resolve entity + fiscal year from title
      4. Deduplicate against existing parliament_source_documents
      5. Insert into source_documents + parliament_source_documents

    Args:
        db_session: SQLAlchemy session (optional — if None, runs metadata-only)
        client: Pre-configured DSpace client (optional)
        max_items: Cap on items to process per run
        min_confidence: Skip items below this classification confidence
        country_id: Country ID for source_document records (defaults to 1 = Kenya)
    """

    def __init__(
        self,
        db_session=None,
        client: Optional[ParliamentDSpaceClient] = None,
        max_items: int = 500,
        min_confidence: float = 0.30,
        country_id: int = 1,
        download_pdfs: bool = False,
        download_dir: str = "downloads/parliament",
    ):
        self.db = db_session
        self.client = client or ParliamentDSpaceClient(max_items=max_items)
        self.classifier = ReportClassifier()
        self.resolver = EntityResolver()
        self.max_items = max_items
        self.min_confidence = min_confidence
        self.country_id = country_id
        self.download_pdfs = download_pdfs
        self.download_dir = download_dir
        self._seen_uuids: set = set()

    def run(
        self,
        dry_run: bool = True,
        community_uuid: str = AUDITOR_GENERAL_COMMUNITY,
        collection_uuid: Optional[str] = None,
    ) -> PipelineStats:
        """Execute the pipeline.

        Args:
            dry_run: If True, logs what would be inserted but does not write to DB.
            community_uuid: DSpace community to crawl (default: National Assembly).
            collection_uuid: If set, scope discovery to this collection only.

        Returns:
            PipelineStats with counts and errors.
        """
        stats = PipelineStats()
        scope_label = collection_uuid or community_uuid
        logger.info(
            "Parliament pipeline starting (dry_run=%s, scope=%s, max_items=%d)",
            dry_run,
            scope_label,
            self.max_items,
        )

        # Pre-load existing UUIDs for dedup
        if self.db and ParliamentSourceDocument is not None:
            try:
                existing = (
                    self.db.query(ParliamentSourceDocument.dspace_uuid)
                    .filter(ParliamentSourceDocument.dspace_uuid.isnot(None))
                    .all()
                )
                self._seen_uuids = {row[0] for row in existing}
                logger.info(
                    "Loaded %d existing Parliament UUIDs for dedup",
                    len(self._seen_uuids),
                )
            except Exception as e:
                if "UndefinedTable" in type(e).__name__ or "UndefinedTable" in str(e):
                    logger.warning(
                        "parliament_source_documents table does not exist. "
                        "Run: cd backend && alembic upgrade head"
                    )
                else:
                    logger.warning("Could not pre-load dedup set: %s", e)
                # Rollback so the session is not left in a failed-transaction state
                self.db.rollback()

        # Discover + process items
        try:
            for item in self.client.discover_items(
                community_uuid=community_uuid,
                collection_uuid=collection_uuid,
            ):
                stats.items_discovered += 1
                try:
                    self._process_item(item, stats, dry_run)
                except Exception as e:
                    logger.error("Error processing item %s: %s", item.uuid, e)
                    stats.errors.append(
                        {"uuid": item.uuid, "title": item.title, "error": str(e)}
                    )
                    # Rollback the failed item so the session stays usable
                    if self.db:
                        self.db.rollback()
        except Exception as e:
            logger.error("Discovery failed: %s", e)
            stats.errors.append({"phase": "discovery", "error": str(e)})

        # Commit if not dry run
        if not dry_run and self.db:
            try:
                self.db.commit()
                logger.info("Committed %d new records", stats.items_inserted)
            except IntegrityError as e:
                # Late uniqueness conflict at commit — treat as partial success
                logger.warning(
                    "Commit IntegrityError (concurrent race): %s — "
                    "rolling back uncommitted batch",
                    e.orig,
                )
                self.db.rollback()
                stats.errors.append({"phase": "commit", "error": str(e.orig)})
            except Exception as e:
                logger.error("Commit failed: %s", e)
                self.db.rollback()
                stats.errors.append({"phase": "commit", "error": str(e)})

        logger.info(stats.summary())
        return stats

    def _process_item(
        self, item: DSpaceItem, stats: PipelineStats, dry_run: bool
    ) -> None:
        """Process a single DSpace item through classify → resolve → load."""

        # 1. Dedup check
        if item.uuid in self._seen_uuids:
            stats.items_skipped_duplicate += 1
            return

        # 2. Classify
        classification = self.classifier.classify(
            title=item.title,
            subjects=item.subjects,
        )
        stats.items_classified += 1

        # 3. Resolve entity
        resolved = self.resolver.resolve(item.title)
        stats.items_resolved += 1

        # 4. Confidence gate
        combined_confidence = (classification.confidence + resolved.confidence) / 2
        if combined_confidence < self.min_confidence:
            stats.items_skipped_low_confidence += 1
            logger.debug(
                "Skipping low-confidence item: %s (conf=%.2f)",
                item.title[:80],
                combined_confidence,
            )
            return

        # 5. Optionally download PDF bitstreams
        downloaded_path = None
        downloaded_md5 = None
        if self.download_pdfs:
            try:
                bitstreams = self.client.get_bitstreams(item.uuid)
                pdf_bits = [b for b in bitstreams if b.is_pdf]
                if pdf_bits:
                    # Download the first (primary) PDF
                    result = self.client.download_bitstream(
                        bitstream=pdf_bits[0],
                        download_dir=self.download_dir,
                        item_uuid=item.uuid,
                        verify_checksum=True,
                        dry_run=dry_run,
                    )
                    if result:
                        if result.get("skipped"):
                            stats.pdfs_skipped += 1
                        elif result.get("dry_run"):
                            stats.pdfs_downloaded += 1  # count dry-run as success
                        else:
                            stats.pdfs_downloaded += 1
                        downloaded_path = result.get("file_path")
                        downloaded_md5 = result.get("md5")
                    else:
                        stats.pdfs_failed += 1
                else:
                    logger.debug("No PDF bitstreams for item %s", item.uuid[:12])
            except Exception as e:
                logger.warning(
                    "Bitstream fetch/download failed for %s: %s", item.uuid[:12], e
                )
                stats.pdfs_failed += 1

        # 6. Log or insert
        if dry_run:
            logger.info(
                "[DRY RUN] Would insert: type=%s, entity=%s (%s), fy=%s, uuid=%s, title=%s",
                classification.doc_type,
                resolved.entity_name,
                resolved.entity_type,
                resolved.fiscal_years,
                item.uuid,
                item.title[:80],
            )
            stats.items_inserted += 1
            self._seen_uuids.add(item.uuid)
            return

        if not self.db or SourceDocument is None:
            logger.warning("No DB session — cannot insert item %s", item.uuid)
            return

        # 7. Create source_document record
        doc_type_map = {
            "audit_report": DocumentType.AUDIT,
            "committee_report": DocumentType.REPORT,
            "budget_estimate": DocumentType.BUDGET,
            "green_book": DocumentType.AUDIT,
            "hansard": DocumentType.REPORT,
            "bill": DocumentType.REPORT,
            "act": DocumentType.REPORT,
            "policy_document": DocumentType.REPORT,
            "other": DocumentType.OTHER,
        }

        # Map classifier string values to SQLAlchemy enum instances
        parliament_doc_type_map = {
            "audit_report": ParliamentDocType.AUDIT_REPORT,
            "committee_report": ParliamentDocType.COMMITTEE_REPORT,
            "budget_estimate": ParliamentDocType.BUDGET_ESTIMATE,
            "green_book": ParliamentDocType.GREEN_BOOK,
            "hansard": ParliamentDocType.HANSARD,
            "bill": ParliamentDocType.BILL,
            "act": ParliamentDocType.ACT,
            "policy_document": ParliamentDocType.POLICY_DOCUMENT,
            "other": ParliamentDocType.OTHER,
        }
        audit_opinion_map = {
            "unqualified": AuditOpinion.UNQUALIFIED,
            "qualified": AuditOpinion.QUALIFIED,
            "adverse": AuditOpinion.ADVERSE,
            "disclaimer": AuditOpinion.DISCLAIMER,
        }

        # 7+8: Insert source_document + parliament_source_document inside
        # a SAVEPOINT so a dspace_uuid uniqueness conflict (concurrent
        # insert race) rolls back only this item, not the whole session.
        try:
            with self.db.begin_nested():
                source_doc = SourceDocument(
                    country_id=self.country_id,
                    publisher="Kenya Parliament Digital Library",
                    title=item.title[:500],
                    url=(
                        f"https://libraryir.parliament.go.ke/handle/{item.handle}"
                        if item.handle
                        else None
                    ),
                    file_path=downloaded_path,
                    fetch_date=datetime.now(timezone.utc),
                    md5=downloaded_md5 or item.content_md5(),
                    doc_type=doc_type_map.get(
                        classification.doc_type, DocumentType.OTHER
                    ),
                    status=DocumentStatus.AVAILABLE,
                    meta={
                        "dspace_uuid": item.uuid,
                        "dspace_handle": item.handle,
                        "date_issued": item.date_issued,
                        "subjects": item.subjects,
                        "publisher": item.publisher,
                        "description": (item.description or "")[:1000],
                    },
                )
                self.db.add(source_doc)
                self.db.flush()  # Get source_doc.id

                parliament_doc = ParliamentSourceDocument(
                    source_document_id=source_doc.id,
                    dspace_uuid=item.uuid,
                    dspace_handle=item.handle,
                    collection_uuid=item.collection_uuid,
                    community_uuid=AUDITOR_GENERAL_COMMUNITY,
                    parliament_doc_type=parliament_doc_type_map.get(
                        classification.doc_type
                    ),
                    fiscal_year_label=(
                        resolved.fiscal_years[0] if resolved.fiscal_years else None
                    ),
                    committee_name=classification.committee_name,
                    audit_opinion=(
                        audit_opinion_map.get(resolved.audit_opinion)
                        if resolved.audit_opinion
                        else None
                    ),
                    confidence_score=combined_confidence,
                    meta={
                        "entity_name": resolved.entity_name,
                        "entity_type": resolved.entity_type,
                        "is_green_book": resolved.is_green_book,
                        "classification_pattern": classification.matched_pattern,
                        "pdf_file_path": downloaded_path,
                        "all_fiscal_years": resolved.fiscal_years,
                    },
                )
                self.db.add(parliament_doc)
                self.db.flush()  # Force dspace_uuid UNIQUE check inside savepoint
        except IntegrityError as e:
            # dspace_uuid UNIQUE violation → concurrent insert race.
            # The SAVEPOINT was rolled back; session stays usable.
            logger.info(
                "Duplicate dspace_uuid %s — skipped (race-safe dedup): %s",
                item.uuid[:12],
                e.orig,
            )
            stats.items_skipped_duplicate += 1
            self._seen_uuids.add(item.uuid)
            return

        stats.items_inserted += 1
        self._seen_uuids.add(item.uuid)
        logger.debug(
            "Inserted: %s → %s (%s) FY=%s pdf=%s",
            item.uuid[:8],
            resolved.entity_name,
            classification.doc_type,
            resolved.fiscal_years,
            "yes" if downloaded_path else "no",
        )


def is_enabled() -> bool:
    """Check if Parliament pipeline is enabled via environment variable."""
    return os.getenv("PARLIAMENT_PIPELINE_ENABLED", "0") == "1"


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Parliament Library Ingestion Pipeline"
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually write to database (default: dry-run)",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=100,
        help="Maximum items to process (default: 100)",
    )
    parser.add_argument(
        "--collection",
        type=str,
        default=None,
        help="Scope to a specific collection UUID (default: entire community)",
    )
    parser.add_argument(
        "--download-pdfs",
        action="store_true",
        help="Download PDF bitstreams to local storage",
    )
    parser.add_argument(
        "--download-dir",
        type=str,
        default="downloads/parliament",
        help="Directory for PDF downloads (default: downloads/parliament)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    dry_run = not args.commit
    if not dry_run and not is_enabled():
        logger.error(
            "Pipeline is not enabled. Set PARLIAMENT_PIPELINE_ENABLED=1 to enable writes."
        )
        sys.exit(1)

    # Try to get a DB session (backend/database.py is already on sys.path from model imports)
    db_session = None
    if not dry_run:
        try:
            from database import SessionLocal

            db_session = SessionLocal()
            logger.info("DB session created via backend SessionLocal")
        except Exception as e:
            logger.warning("Could not create DB session: %s — running dry-run only", e)
            dry_run = True

    pipeline = ParliamentPipeline(
        db_session=db_session,
        max_items=args.max_items,
        download_pdfs=args.download_pdfs,
        download_dir=args.download_dir,
    )
    stats = pipeline.run(dry_run=dry_run, collection_uuid=args.collection)
    print(stats.summary())

    if db_session:
        db_session.close()


if __name__ == "__main__":
    main()
