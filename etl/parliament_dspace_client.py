"""
DSpace 7 REST API client for the Kenya Parliament Digital Library.

Base URL: https://libraryir.parliament.go.ke/server/api
Key community: Auditor-General Reports (UUID 81b68525-fa59-4556-8a8b-f49acfba88b9)

This client handles:
  - Paginated item discovery across communities / collections
  - Metadata extraction from DSpace item records
  - Bitstream URL resolution and PDF download
  - Checksum verification (DSpace provides MD5 per bitstream)
  - Deduplication via dspace_uuid tracking
  - Retry + back-off for intermittent failures
"""

import hashlib
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple
from urllib.parse import urljoin

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

BASE_URL = "https://libraryir.parliament.go.ke/server/api"

# ── Known community and collection UUIDs (verified via live validation) ────
#
# Bunge Library hierarchy:
#   01 NATIONAL ASSEMBLY (553fd85c)
#     ├── Auditor-General Reports (406702ec) ← 12,853 items — primary target
#     │     ├── Constituencies AG Reports (52c20d8b)
#     │     ├── State Corporations (ee0116f6)
#     │     ├── Universities/TVET (0ce4db1b)
#     │     └── ...more collections
#     ├── Commission Reports (f3207eb4)
#     ├── Controller of Budget Reports (0f991f65)
#     ├── Departmental Committees (ac0a4a53)
#     ├── Financial/Audit Committees (a5b0e30d)
#     ├── Hansard Reports (fef86f4f)
#     └── ...more sub-communities
#   02 SENATE (81b68525)
#

NATIONAL_ASSEMBLY_COMMUNITY = "553fd85c-94a1-4de2-a03b-726b05f9c75d"
SENATE_COMMUNITY = "81b68525-fa59-4556-8a8b-f49acfba88b9"

# Auditor-General Reports sub-community — the primary ingestion target.
# Confirmed via Chrome fetch against live endpoint (12,853 items).
# Name: "Auditor-General Reports"
AUDITOR_GENERAL_SUBCOMMUNITY = "406702ec-79b0-4cc5-a2fe-28dfd6ccade4"  # confirmed via live Chrome validation

# Default scope for the pipeline: prefer the AG sub-community if available,
# fall back to the entire National Assembly.
AUDITOR_GENERAL_COMMUNITY = AUDITOR_GENERAL_SUBCOMMUNITY

# Legacy alias — this is actually 02 SENATE, NOT the AG community.
# Kept for reference / documentation; do NOT use for AG discovery.
AUDITOR_GENERAL_COMMUNITY_LEGACY = SENATE_COMMUNITY

# Verified collection UUIDs (from live site)
COLLECTION_CONSTITUENCIES_AG = "52c20d8b-dc91-49e7-ba17-8cc24a8a6bb1"
COLLECTION_STATE_CORPORATIONS = "ee0116f6-9951-4fe0-85c8-4112ee04dc00"  # State Corporations under AG
COLLECTION_UNIVERSITIES_TVET = "0ce4db1b-dd3e-4394-bb04-de26ba8b32c1"
COLLECTION_COB = "a0e8b4a8-2568-40b8-9a18-06f9bf6cc0ea"

# DSpace 7 REST endpoints
ENDPOINT_COMMUNITIES = "/core/communities"
ENDPOINT_COLLECTIONS = "/core/collections"
ENDPOINT_ITEMS = "/core/items"
ENDPOINT_BUNDLES = "/core/bundles"
ENDPOINT_BITSTREAMS = "/core/bitstreams"
ENDPOINT_DISCOVERY = "/discover/search/objects"

# Rate limiting
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
REQUEST_DELAY_SECONDS = 0.5
MAX_RETRIES = 3

# Download defaults
DEFAULT_DOWNLOAD_DIR = "downloads/parliament"
MAX_PDF_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB safety cap (some AG reports are 200+ MB)


@dataclass
class BitstreamInfo:
    """Resolved bitstream metadata from DSpace."""

    uuid: str
    name: str
    href: str
    mime_type: str
    size_bytes: int
    checksum_algorithm: str = ""
    checksum_value: str = ""

    @property
    def is_pdf(self) -> bool:
        """Check if this bitstream is a PDF.

        The live Parliament DSpace returns application/octet-stream for many
        PDFs instead of application/pdf, so we check the filename first.
        """
        if self.name.lower().endswith(".pdf"):
            return True
        return self.mime_type == "application/pdf"


@dataclass
class DSpaceItem:
    """Normalised representation of a DSpace item."""

    uuid: str
    handle: str
    name: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    collection_uuid: Optional[str] = None
    community_uuid: Optional[str] = None
    bitstreams: List[BitstreamInfo] = field(default_factory=list)

    @property
    def title(self) -> str:
        """Primary title from dc.title metadata."""
        return self._meta_first("dc.title") or self.name

    @property
    def date_issued(self) -> Optional[str]:
        """dc.date.issued value (typically a year or ISO date)."""
        return self._meta_first("dc.date.issued")

    @property
    def description(self) -> Optional[str]:
        return self._meta_first("dc.description.abstract") or self._meta_first(
            "dc.description"
        )

    @property
    def subjects(self) -> List[str]:
        return self._meta_list("dc.subject")

    @property
    def authors(self) -> List[str]:
        return self._meta_list("dc.contributor.author")

    @property
    def publisher(self) -> Optional[str]:
        return self._meta_first("dc.publisher")

    @property
    def pdf_bitstreams(self) -> List[BitstreamInfo]:
        """Filter bitstreams to only PDFs."""
        return [b for b in self.bitstreams if b.is_pdf]

    def content_md5(self) -> str:
        """Stable fingerprint based on uuid + title for dedup."""
        raw = f"{self.uuid}|{self.title}".encode()
        return hashlib.md5(raw).hexdigest()

    # ── helpers ──

    def _meta_first(self, key: str) -> Optional[str]:
        values = self.metadata.get(key, [])
        if isinstance(values, list) and values:
            v = values[0]
            return v.get("value") if isinstance(v, dict) else str(v)
        if isinstance(values, str):
            return values
        return None

    def _meta_list(self, key: str) -> List[str]:
        values = self.metadata.get(key, [])
        if not isinstance(values, list):
            return [str(values)] if values else []
        out = []
        for v in values:
            out.append(v.get("value") if isinstance(v, dict) else str(v))
        return out


class ParliamentDSpaceClient:
    """Paginated client for DSpace 7 REST API at libraryir.parliament.go.ke."""

    def __init__(
        self,
        base_url: str = BASE_URL,
        page_size: int = DEFAULT_PAGE_SIZE,
        request_delay: float = REQUEST_DELAY_SECONDS,
        max_items: Optional[int] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.page_size = min(page_size, MAX_PAGE_SIZE)
        self.request_delay = request_delay
        self.max_items = max_items

        # Resilient session with retry
        self.session = requests.Session()
        retries = Retry(
            total=MAX_RETRIES,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.session.headers.update(
            {
                "Accept": "application/json",
                "User-Agent": "AuditGava-ETL/1.0 (civic-accountability-platform)",
            }
        )

    # ── Public API ─────────────────────────────────────────────────────────

    def get_community(self, uuid: str) -> Dict[str, Any]:
        """Fetch a single community by UUID."""
        return self._get(f"{ENDPOINT_COMMUNITIES}/{uuid}")

    def list_subcommunities(self, community_uuid: str) -> List[Dict[str, Any]]:
        """List sub-communities within a parent community.

        The Bunge Library organises content as:
          Community (e.g. 01 NATIONAL ASSEMBLY)
            └─ Sub-community (e.g. Auditor-General Reports)
                └─ Collection (e.g. Constituencies AG Reports)
        """
        url = f"{ENDPOINT_COMMUNITIES}/{community_uuid}/subcommunities"
        items = []
        for page_data in self._paginate(url):
            embedded = page_data.get("_embedded", {})
            subcommunities = embedded.get("subcommunities", embedded.get("communities", []))
            items.extend(subcommunities)
        return items

    def list_collections(self, community_uuid: str) -> List[Dict[str, Any]]:
        """List all collections within a community."""
        url = f"{ENDPOINT_COMMUNITIES}/{community_uuid}/collections"
        items = []
        for page_data in self._paginate(url):
            embedded = page_data.get("_embedded", {})
            collections = embedded.get("collections", [])
            items.extend(collections)
        return items

    def discover_items(
        self,
        community_uuid: Optional[str] = None,
        collection_uuid: Optional[str] = None,
        query: str = "*",
    ) -> Generator[DSpaceItem, None, None]:
        """Discover items via the search endpoint, yielding normalised DSpaceItems.

        Paginates automatically and respects self.max_items.
        Can scope to either a community or a collection.
        """
        yielded = 0
        params: Dict[str, Any] = {
            "query": query,
            "dsoType": "ITEM",
            "size": self.page_size,
        }
        # Scope: collection takes priority over community
        scope = collection_uuid or community_uuid
        if scope:
            params["scope"] = scope

        page = 0
        while True:
            params["page"] = page
            try:
                data = self._get(ENDPOINT_DISCOVERY, params=params)
            except Exception as e:
                logger.error("Discovery page %d failed: %s", page, e)
                break

            embedded = data.get("_embedded", {})
            search_result = embedded.get("searchResult", {})
            result_embedded = search_result.get("_embedded", {})
            objects = result_embedded.get("objects", [])

            if not objects:
                break

            for obj in objects:
                indexed = obj.get("_embedded", {}).get("indexableObject", {})
                if not indexed or indexed.get("type") != "item":
                    continue

                item = self._parse_item(indexed)
                if item:
                    yield item
                    yielded += 1
                    if self.max_items and yielded >= self.max_items:
                        return

            # Check for next page
            page_info = data.get("_embedded", {}).get("searchResult", {}).get("page", {})
            total_pages = page_info.get("totalPages", 1)
            if page + 1 >= total_pages:
                break
            page += 1

    def get_item(self, uuid: str) -> Optional[DSpaceItem]:
        """Fetch a single item by UUID and return normalised representation."""
        try:
            data = self._get(f"{ENDPOINT_ITEMS}/{uuid}")
            return self._parse_item(data)
        except Exception as e:
            logger.error("Failed to fetch item %s: %s", uuid, e)
            return None

    def get_bitstreams(self, item_uuid: str) -> List[BitstreamInfo]:
        """Resolve downloadable bitstream metadata for an item.

        Only returns bitstreams from the ORIGINAL bundle (the actual
        uploaded files, not thumbnails or extracted text).

        DSpace 7 checkSum object: {"checkSumAlgorithm": "MD5", "value": "abc..."}
        """
        results = []
        try:
            data = self._get(f"{ENDPOINT_ITEMS}/{item_uuid}/bundles")
            embedded = data.get("_embedded", {})
            bundles = embedded.get("bundles", [])

            for bundle in bundles:
                bundle_name = bundle.get("name", "")
                if bundle_name != "ORIGINAL":
                    continue
                # Fetch bitstreams for this bundle
                bundle_uuid = bundle.get("uuid")
                if not bundle_uuid:
                    continue
                bs_data = self._get(
                    f"{ENDPOINT_BUNDLES}/{bundle_uuid}/bitstreams"
                )
                bs_embedded = bs_data.get("_embedded", {})
                bitstreams = bs_embedded.get("bitstreams", [])
                for bs in bitstreams:
                    bs_uuid = bs.get("uuid", "")
                    bs_name = bs.get("name", "")
                    bs_size = bs.get("sizeBytes", 0)

                    # Mime type: try _embedded.format first, fall back to _links
                    mime = "application/octet-stream"
                    fmt = bs.get("_embedded", {}).get("format", {})
                    if fmt:
                        mime = fmt.get("mimetype", mime)

                    # Checksum: DSpace 7 uses camelCase "checkSum"
                    cs = bs.get("checkSum", bs.get("checksum", {}))
                    cs_algo = cs.get("checkSumAlgorithm", "") if isinstance(cs, dict) else ""
                    cs_value = cs.get("value", "") if isinstance(cs, dict) else ""

                    href = (
                        f"{self.base_url}{ENDPOINT_BITSTREAMS}"
                        f"/{bs_uuid}/content"
                    )
                    results.append(
                        BitstreamInfo(
                            uuid=bs_uuid,
                            name=bs_name,
                            href=href,
                            mime_type=mime,
                            size_bytes=bs_size,
                            checksum_algorithm=cs_algo,
                            checksum_value=cs_value,
                        )
                    )
        except Exception as e:
            logger.error("Failed to fetch bitstreams for item %s: %s", item_uuid, e)

        return results

    # Legacy alias for backward compatibility
    def get_bitstream_urls(self, item_uuid: str) -> List[Dict[str, str]]:
        """Legacy wrapper — returns dicts instead of BitstreamInfo."""
        return [
            {
                "uuid": b.uuid,
                "name": b.name,
                "href": b.href,
                "mime_type": b.mime_type,
                "size_bytes": b.size_bytes,
            }
            for b in self.get_bitstreams(item_uuid)
        ]

    def download_bitstream(
        self,
        bitstream: BitstreamInfo,
        download_dir: str = DEFAULT_DOWNLOAD_DIR,
        item_uuid: str = "",
        verify_checksum: bool = True,
        dry_run: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Download a single bitstream (PDF) to local storage.

        File naming: {item_uuid[:12]}_{sanitised_name}
        Dedup: skip if file with matching checksum already exists.

        Args:
            bitstream: BitstreamInfo from get_bitstreams()
            download_dir: Local directory for downloads
            item_uuid: Parent item UUID (used in filename)
            verify_checksum: Verify MD5 after download
            dry_run: If True, log but do not download

        Returns:
            Dict with file_path, md5, size_bytes, or None on failure.
        """
        dl_path = Path(download_dir)
        dl_path.mkdir(parents=True, exist_ok=True)

        # Sanitise filename
        safe_name = "".join(
            c if c.isalnum() or c in ".-_ " else "_"
            for c in bitstream.name
        ).strip()
        if not safe_name:
            safe_name = f"{bitstream.uuid}.pdf"
        prefix = item_uuid[:12] if item_uuid else bitstream.uuid[:12]
        filename = f"{prefix}_{safe_name}"
        dest = dl_path / filename

        # Dedup: check if file already exists with matching checksum
        if dest.exists() and bitstream.checksum_value:
            existing_md5 = hashlib.md5(dest.read_bytes()).hexdigest()
            if existing_md5 == bitstream.checksum_value:
                logger.debug("Skipping (already downloaded, checksum matches): %s", filename)
                return {
                    "file_path": str(dest),
                    "md5": existing_md5,
                    "size_bytes": dest.stat().st_size,
                    "skipped": True,
                }

        if dry_run:
            logger.info(
                "[DRY RUN] Would download: %s (%s bytes) → %s",
                bitstream.name,
                bitstream.size_bytes,
                dest,
            )
            return {
                "file_path": str(dest),
                "md5": bitstream.checksum_value,
                "size_bytes": bitstream.size_bytes,
                "dry_run": True,
            }

        # Size safety check
        if bitstream.size_bytes > MAX_PDF_SIZE_BYTES:
            logger.warning(
                "Skipping oversized bitstream %s (%d bytes > %d max)",
                bitstream.name,
                bitstream.size_bytes,
                MAX_PDF_SIZE_BYTES,
            )
            return None

        # Download with streaming
        try:
            time.sleep(self.request_delay)
            logger.info("Downloading: %s → %s", bitstream.href, dest)
            resp = self.session.get(bitstream.href, stream=True, timeout=120)
            resp.raise_for_status()

            md5_hash = hashlib.md5()
            total_bytes = 0
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
                        md5_hash.update(chunk)
                        total_bytes += len(chunk)

            computed_md5 = md5_hash.hexdigest()

            # Verify checksum if available
            if verify_checksum and bitstream.checksum_value:
                if computed_md5 != bitstream.checksum_value:
                    logger.error(
                        "Checksum mismatch for %s: expected=%s computed=%s — removing file",
                        filename,
                        bitstream.checksum_value,
                        computed_md5,
                    )
                    dest.unlink(missing_ok=True)
                    return None

            logger.info(
                "Downloaded OK: %s (%d bytes, md5=%s)",
                filename,
                total_bytes,
                computed_md5,
            )
            return {
                "file_path": str(dest),
                "md5": computed_md5,
                "size_bytes": total_bytes,
            }

        except Exception as e:
            logger.error("Download failed for %s: %s", bitstream.name, e)
            dest.unlink(missing_ok=True)
            return None

    # ── Internals ──────────────────────────────────────────────────────────

    def _get(
        self, endpoint: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Rate-limited GET request returning JSON."""
        url = (
            endpoint
            if endpoint.startswith("http")
            else f"{self.base_url}{endpoint}"
        )
        time.sleep(self.request_delay)
        logger.debug("GET %s params=%s", url, params)
        resp = self.session.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def _paginate(
        self, endpoint: str, params: Optional[Dict[str, Any]] = None
    ) -> Generator[Dict[str, Any], None, None]:
        """Generic paginator for HAL+JSON responses."""
        params = dict(params or {})
        params.setdefault("size", self.page_size)
        page = 0
        while True:
            params["page"] = page
            data = self._get(endpoint, params=params)
            yield data
            page_info = data.get("page", {})
            total_pages = page_info.get("totalPages", 1)
            if page + 1 >= total_pages:
                break
            page += 1

    def _parse_item(self, data: Dict[str, Any]) -> Optional[DSpaceItem]:
        """Parse a raw DSpace item JSON into a DSpaceItem."""
        uuid = data.get("uuid")
        if not uuid:
            return None

        handle = data.get("handle", "")
        name = data.get("name", "")
        metadata_raw = data.get("metadata", {})

        return DSpaceItem(
            uuid=uuid,
            handle=handle,
            name=name,
            metadata=metadata_raw,
        )
