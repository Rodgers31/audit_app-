"""Budget domain fetcher with live COB PDF integration.

Strategy (in order):
1. If counties_budget_prefer_live_source AND live_pdf_fetch_enabled,
   try to discover the latest COB County Budget Implementation Review
   Report (C-BIRR) PDF and parse it.
2. Fall back to the static fixture / configured URL.

County budget data primarily comes from the Controller of Budget (COB)
quarterly reports. Unlike national-level data, there is no free API —
the data is published in PDF reports at
https://cob.go.ke/publications/consolidated-county-budget-implementation-review-reports/
"""

from __future__ import annotations

import logging
import re
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.counties_budget.fetcher")

# COB migrated from /reports/ to /publications/ paths (2025). Order is
# significant — the consolidated page publishes the single "all counties"
# BIRR PDF that covers sectoral + aggregate breakdowns in one artefact,
# so we try that first. /county-reports/ hosts per-county PDFs (harder
# to aggregate), and the legacy /reports/ path only survives as a redirect
# for old search hits.
_COB_COUNTY_BIRR_URLS = [
    "https://cob.go.ke/publications/consolidated-county-budget-implementation-review-reports/",
    "https://cob.go.ke/publications/county-reports/",
    "https://cob.go.ke/reports/county-governments-budget-implementation-review-reports/",  # legacy
]


def _derive_fiscal_year_dates(fy: str) -> Tuple[Optional[str], Optional[str]]:
    """Return ISO start_date/end_date for a Kenyan fiscal-year label.

    Kenya runs FY July 1 → June 30. Accepts "2024/2025", "2024/25",
    "FY2024/25", "FY 2024-25" and similar. Returns ("2024-07-01",
    "2025-06-30") or (None, None) if the label cannot be parsed.
    """
    if not fy:
        return None, None
    m = re.search(r"(\d{4})[/\-](\d{2,4})", fy)
    if not m:
        return None, None
    start_year = int(m.group(1))
    tail = m.group(2)
    # "25" → 2025; "2025" → 2025 (idempotent).
    end_year = int(tail) if len(tail) == 4 else 2000 + int(tail)
    # Sanity: end must be start+1.
    if end_year - start_year != 1:
        return None, None
    return f"{start_year}-07-01", f"{end_year}-06-30"


def fetch_budget_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> Any:
    """Retrieve the budgets dataset, trying live COB PDF first.

    Strategy:
    1. Try live PDF fetch from COB county BIRR reports page.
    2. Fall back to configured fixture/API URL.
    """
    # Strategy 1: Live PDF fetch — gated by two toggles so operators
    # can disable independently:
    #   * live_pdf_fetch_enabled — global kill-switch for all PDF
    #     scraping (CBK, Treasury, COB). Useful for offline dev.
    #   * counties_budget_prefer_live_source — domain-specific toggle
    #     added April-2026 to let us freeze the fixture output for
    #     snapshot tests even when global PDF fetching is on.
    prefer_live = getattr(settings, "counties_budget_prefer_live_source", True)
    if settings.live_pdf_fetch_enabled and prefer_live:
        try:
            payload = _fetch_from_cob_county_pdf(client, settings)
            if payload and len(payload) > 0:
                logger.info(
                    "Successfully fetched county budgets from COB PDF (%d records)",
                    len(payload) if isinstance(payload, list) else 0,
                )
                return payload
            else:
                logger.warning(
                    "COB county PDF fetch returned no budget data, "
                    "falling back to fixture"
                )
        except Exception as exc:
            logger.warning(
                "COB county PDF fetch failed, falling back to fixture: %s", exc
            )
    elif not prefer_live:
        logger.info(
            "counties_budget_prefer_live_source=False — skipping COB PDF fetch"
        )

    # Strategy 2: Fixture fallback
    logger.info("Using fixture/configured URL for county budget data")
    return load_json_resource(
        url=settings.budgets_dataset_url,
        client=client,
        logger=logger,
        label="budgets",
    )


def _fetch_from_cob_county_pdf(
    client: SeedingHttpClient, settings: SeedingSettings
) -> Optional[List[Dict[str, Any]]]:
    """Discover and parse the latest COB county BIRR PDF."""
    # Try multiple URLs since COB restructures their site periodically.
    # The configured landing page (settings.counties_budget_cob_reports_url)
    # is prepended so operators can override the probe order via env vars
    # without a code change.
    candidate_urls: List[str] = []
    configured = getattr(settings, "counties_budget_cob_reports_url", None)
    if configured:
        candidate_urls.append(configured)
    for url in _COB_COUNTY_BIRR_URLS:
        if url not in candidate_urls:
            candidate_urls.append(url)

    html = None
    page_url = candidate_urls[0]
    for url in candidate_urls:
        try:
            logger.info("Fetching COB county BIRR reports page: %s", url)
            response = client.get(url, raise_for_status=True)
            html = response.text
            page_url = url
            break
        except Exception as exc:
            logger.warning("COB county page unavailable at %s: %s", url, exc)

    if not html:
        raise RuntimeError("Could not reach COB county reports at any known URL")

    pdf_url = _discover_latest_county_birr_pdf(html, page_url)
    if not pdf_url:
        logger.warning("No county BIRR PDF link found on COB reports page")
        return None

    logger.info("Downloading COB county BIRR PDF: %s", pdf_url)
    return _download_and_parse_county_pdf(client, pdf_url)


def _discover_latest_county_birr_pdf(
    html: str, base_url: str
) -> Optional[str]:
    """Extract the most recent county BIRR PDF URL from the COB page."""
    pdf_pattern = re.compile(
        r'href=["\']([^"\']*\.pdf)["\']',
        re.IGNORECASE,
    )
    all_pdfs = pdf_pattern.findall(html)
    if not all_pdfs:
        return None

    # Filter for county budget-related PDFs
    county_keywords = [
        "county", "c-birr", "cbirr", "county-government",
        "county_government", "county-budget",
    ]
    county_pdfs = [
        url for url in all_pdfs
        if any(kw in url.lower() for kw in county_keywords)
    ]

    candidates = county_pdfs if county_pdfs else all_pdfs
    if not candidates:
        return None

    chosen = candidates[0]
    if not chosen.startswith(("http://", "https://")):
        chosen = urljoin(base_url, chosen)

    return chosen


def _download_and_parse_county_pdf(
    client: SeedingHttpClient, pdf_url: str
) -> Optional[List[Dict[str, Any]]]:
    """Download a COB county BIRR PDF, parse it, return budget records."""
    tmp_path: Optional[Path] = None
    try:
        from ...pdf_parsers import CoBQuarterlyReportParser

        response = client.get(pdf_url, raise_for_status=True)

        with tempfile.NamedTemporaryFile(
            suffix=".pdf", delete=False, prefix="cob_county_birr_"
        ) as tmp:
            tmp.write(response.content)
            tmp_path = Path(tmp.name)

        logger.info(
            "Downloaded COB county BIRR PDF (%d bytes) to %s",
            len(response.content),
            tmp_path,
        )

        parser = CoBQuarterlyReportParser(tmp_path)
        parsed_records = parser.parse()

        if not parsed_records:
            logger.warning("CoBQuarterlyReportParser returned no records")
            return None

        # Convert to the budget parser's expected schema. Three pipeline
        # invariants enforced here (silently-wrong before April-2026):
        #   * key "actual_amount" — parser.py reads that; "actual_spent"
        #     was silently dropped.
        #   * start_date / end_date — parser.py requires ISO dates and
        #     drops the record otherwise (Kenya FY = Jul 1 → Jun 30).
        #   * period_label — parser falls back to fiscal_year but we
        #     set it explicitly so the normalized label is canonical.
        budget_records: List[Dict[str, Any]] = []
        dropped_no_fy = 0
        for record in parsed_records:
            county = record.get("county", "Unknown")
            entity_slug = county.lower().replace(" ", "-") + "-county"
            fy = record.get("fiscal_year", "")

            start_iso, end_iso = _derive_fiscal_year_dates(fy)
            if not start_iso or not end_iso:
                dropped_no_fy += 1
                continue

            allocated = record.get("allocated", 0)
            absorbed = record.get("absorbed", 0)
            if isinstance(allocated, str):
                try:
                    allocated = float(allocated.replace(",", ""))
                except ValueError:
                    allocated = 0
            if isinstance(absorbed, str):
                try:
                    absorbed = float(absorbed.replace(",", ""))
                except ValueError:
                    absorbed = 0

            budget_records.append({
                "entity_slug": entity_slug,
                "entity": f"{county} County",
                "fiscal_year": fy,
                "period_label": fy,
                "start_date": start_iso,
                "end_date": end_iso,
                "category": record.get("category", "Total"),
                "subcategory": record.get("subcategory"),
                "allocated_amount": float(allocated),
                # IMPORTANT: parser reads "actual_amount" or "actual";
                # the old "actual_spent" key was silently dropped.
                "actual_amount": float(absorbed),
                "committed_amount": None,
                "currency": "KES",
                "source_label": (
                    f"Controller of Budget County BIRR {fy}"
                    if fy
                    else "Controller of Budget County BIRR"
                ),
                "source_url": pdf_url,
                "data_quality": "official",
                "notes": record.get("notes"),
            })

        if dropped_no_fy:
            logger.warning(
                "Dropped %d COB records with un-parseable fiscal_year label",
                dropped_no_fy,
            )

        return budget_records if budget_records else None

    except ImportError:
        logger.warning(
            "CoBQuarterlyReportParser not available — "
            "install pdfplumber for live PDF parsing"
        )
        return None
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass


__all__ = ["fetch_budget_payload"]
