"""
Enhanced data ingestion pipeline for MVP
Focuses on actual Kenyan government data sources
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import warnings
import xml.etree.ElementTree as ET
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
import urllib3
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    import boto3  # type: ignore
    from botocore.exceptions import ClientError  # type: ignore
except Exception:  # boto3 optional
    boto3 = None  # type: ignore
    ClientError = Exception  # type: ignore

# Import pipeline dependencies; handle optional DB loader gracefully
try:
    from .audit_parser import AuditParser
except Exception:
    from etl.audit_parser import AuditParser  # type: ignore

# Database loader is optional; if it fails to import (e.g., DB models error), use Noop later
try:
    from .database_loader import DatabaseLoader  # type: ignore
except Exception:
    try:
        from etl.database_loader import DatabaseLoader  # type: ignore
    except Exception:
        DatabaseLoader = None  # type: ignore

try:
    from .extractor import DocumentExtractor
except Exception:
    from etl.extractor import DocumentExtractor  # type: ignore

try:
    from .normalizer import DataNormalizer
except Exception:
    from etl.normalizer import DataNormalizer  # type: ignore

try:
    from .source_registry import registry
except Exception:
    from etl.source_registry import registry  # type: ignore


class NoopDatabaseLoader:
    async def load_audit_findings_document(self, document_record, findings):
        return 1

    async def load_document(self, document_record, normalized_data):
        return 1


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KenyaDataPipeline:
    """
    MVP implementation for Kenya-specific data sources:
    - National Treasury (budget documents)
    - Office of the Controller of Budget (county implementation)
    - Office of the Auditor General (audit reports)
    """

    def __init__(self, storage_path: str = None):
        # Default to a downloads folder alongside this file so backend can read it
        default_storage = Path(__file__).parent / "downloads"
        self.storage_path = Path(storage_path) if storage_path else default_storage
        self.storage_path.mkdir(exist_ok=True)
        self.manifest_path = self.storage_path / "processed_manifest.json"
        self.processed_manifest = self._load_manifest()
        self.extractor = DocumentExtractor()
        self.normalizer = DataNormalizer()
        self.audit_parser = AuditParser()
        # Database loader is optional; fall back to a no-op when DB models aren't available
        try:
            self.db_loader = (
                DatabaseLoader() if DatabaseLoader else NoopDatabaseLoader()
            )
        except Exception:
            logger.warning(
                "DatabaseLoader unavailable; using NoopDatabaseLoader for this run"
            )
            self.db_loader = NoopDatabaseLoader()

        # HTTP session with a reasonable User-Agent; we'll allow per-host SSL fallback
        self.http = requests.Session()
        self.http.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                )
            }
        )
        retry_strategy = Retry(
            total=5,
            connect=5,
            read=5,
            status=5,
            backoff_factor=1.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods={"GET", "HEAD"},
            respect_retry_after_header=True,
            raise_on_status=False,
        )
        adapter = HTTPAdapter(
            max_retries=retry_strategy, pool_maxsize=16, pool_block=True
        )
        self.http.mount("https://", adapter)
        self.http.mount("http://", adapter)
        # Silence SSL warnings only for our explicit insecure fallbacks
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        warnings.simplefilter("ignore", urllib3.exceptions.InsecureRequestWarning)

        # Optional object storage (S3-compatible)
        self.s3 = None
        self.s3_bucket = os.getenv("AWS_BUCKET_NAME")
        self.s3_region = os.getenv("AWS_REGION", "us-east-1")
        if boto3 and self.s3_bucket and os.getenv("AWS_ACCESS_KEY_ID"):
            try:
                self.s3 = boto3.client(
                    "s3",
                    region_name=self.s3_region,
                    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                )
            except Exception:
                self.s3 = None

        # Known Kenya government URLs (as of MVP)
        self.kenya_sources = {
            "treasury": {
                "name": "National Treasury Kenya",
                "base_url": "https://treasury.go.ke",
                # Previous budget URL 404s; discovery seeds are set inside _discover_treasury
                "budget_url": "https://treasury.go.ke/",
                "documents": [
                    "budget-statement",
                    "programme-based-budget",
                    "county-allocation",
                    "debt-management",
                ],
            },
            "cob": {
                "name": "Controller of Budget",
                "base_url": "https://cob.go.ke",
                "reports_url": "https://cob.go.ke/budget-implementation-review-reports/",
                "documents": [
                    "county-budget-implementation",
                    "quarterly-reports",
                    "annual-reports",
                ],
            },
            "oag": {
                "name": "Office of the Auditor General",
                # Use the www host to match the site's TLS certificate and avoid SSL hostname mismatch
                "base_url": "https://www.oagkenya.go.ke",
                # Point to a canonical audits section; discovery will include county/specialized
                "reports_url": "https://www.oagkenya.go.ke/national-government-audit-reports/",
                "documents": [
                    "county-audit-reports",
                    "national-audit-reports",
                    "special-audits",
                ],
            },
        }

    def _load_manifest(self) -> Dict[str, Any]:
        try:
            if self.manifest_path.exists():
                import json as _json

                return _json.loads(self.manifest_path.read_text())
        except Exception:
            pass
        return {"by_md5": {}}

    def _save_manifest(self) -> None:
        try:
            import json as _json

            self.manifest_path.write_text(
                _json.dumps(self.processed_manifest, indent=2)
            )
        except Exception:
            pass

    def _fetch_html(self, url: str, source_key: str) -> Optional[BeautifulSoup]:
        """Fetch HTML with SSL fallback for OAG/COB; return soup or None."""
        try:
            resp = self.http.get(url, timeout=60)
            resp.raise_for_status()
            return BeautifulSoup(resp.content, "html.parser")
        except Exception as e:
            # SSL fallback for tricky hosts
            if source_key in {"oag", "cob"}:
                try:
                    resp = self.http.get(url, timeout=60, verify=False)
                    resp.raise_for_status()
                    return BeautifulSoup(resp.content, "html.parser")
                except Exception as e2:
                    logger.error(f"{source_key} fetch failed (insecure): {e2}")
                    return None
            logger.error(f"Fetch failed: {e}")
            return None

    def _resolve_pdfs_on_page(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Return list of absolute file URLs (pdf/xls/xlsx/csv/doc/docx/zip); also honors 'Download' links."""
        pdfs: List[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            text = (a.get_text(strip=True) or "").lower()
            if (
                re.search(r"\.(pdf|xlsx?|csv|docx?|zip)($|\?)", href, re.I)
                or text == "download"
            ):
                pdfs.append(self._resolve_url(href, base_url))
        # Deduplicate
        seen = set()
        out = []
        for u in pdfs:
            if u not in seen:
                seen.add(u)
                out.append(u)
        return out

    def _discover_oag(self) -> List[Dict[str, Any]]:
        """Discover OAG Financial Audit reports across nested National/County sections with breadcrumbs and level metadata."""
        source = self.kenya_sources["oag"]
        base = source["base_url"]
        host = urlparse(base).netloc.replace("www.", "")

        section_levels = [
            (
                "https://www.oagkenya.go.ke/national-government-audit-reports/",
                "national",
            ),
            ("https://www.oagkenya.go.ke/county-governments-reports/", "county"),
            ("https://www.oagkenya.go.ke/specialized-audit-reports/", "specialized"),
            ("https://www.oagkenya.go.ke/special-audit-report/", "special"),
        ]

        q = deque(
            [
                {"url": u, "level": lvl, "breadcrumbs": [lvl]}
                for (u, lvl) in section_levels
            ]
        )
        for u, lvl in section_levels:
            for i in range(2, 8):
                q.append(
                    {
                        "url": u.rstrip("/") + f"/page/{i}/",
                        "level": lvl,
                        "breadcrumbs": [lvl],
                    }
                )

        # Focused category seeds (skip known 404s: national-government-funds, ng-cdf, universities, tvets, etc.)
        for u in [
            # National
            "https://www.oagkenya.go.ke/ministries-departments-and-agencies/",
            "https://www.oagkenya.go.ke/state-corporations/",
            "https://www.oagkenya.go.ke/political-parties/",
            "https://www.oagkenya.go.ke/implementation-of-audit-recommendations/",
        ]:
            q.append({"url": u, "level": "national", "breadcrumbs": ["national"]})
        for u in [
            # County
            "https://www.oagkenya.go.ke/county-executives-assemblies-reports/",
            "https://www.oagkenya.go.ke/county-funds/",
            "https://www.oagkenya.go.ke/county-revenue-funds/",
        ]:
            q.append({"url": u, "level": "county", "breadcrumbs": ["county"]})

        seen_pages: set[str] = set()
        collected: List[Dict[str, Any]] = []
        max_pages = 700
        pages = 0

        def same_host(u: str) -> bool:
            try:
                p = urlparse(u)
            except Exception:
                return False
            return (
                p.scheme in ("http", "https") and p.netloc.replace("www.", "") == host
            )

        def is_http_link(href: str) -> bool:
            if not href:
                return False
            h = href.strip().lower()
            if h.startswith(("#", "mailto:", "tel:", "javascript:")):
                return False
            return True

        generic_nav = {
            "home",
            "about us",
            "contact us",
            "media center",
            "publications",
            "tenders",
        }
        known_paths = [
            "/national-government-audit-reports",
            "/county-governments-reports",
            "/specialized-audit-reports",
            "/special-audit-report",
            "/ministries-departments-and-agencies",
            "/state-corporations",
            "/political-parties",
            "/implementation-of-audit-recommendations",
            "/county-executives-assemblies-reports",
            "/county-funds",
            "/county-revenue-funds",
        ]
        card_terms = {
            "ministries",
            "departments",
            "agencies",
            "national government funds",
            "ng-cdf",
            "state corporations",
            "sagas",
            "universities",
            "universities enterprises",
            "tvets",
            "polytechnics",
            "political parties",
            "schools",
            "implementation of audit recommendations",
            "county executives",
            "assemblies",
            "county receivers of revenue",
            "municipalities",
            "boards",
            "county funds",
            "hospitals",
            "water companies",
            "county revenue funds",
        }

        def should_enqueue(resolved: str, text: str) -> bool:
            path = (urlparse(resolved).path or "/").lower()
            t = (text or "").lower()
            if any(k in path for k in ["/page/", "/audit", "/reports/", "/category/"]):
                return True
            if re.search(r"\b(fy\s*20\d{2}|20\d{2}\s*[/–-]\s*20\d{2})\b", t):
                return True
            if re.search(r"/(fy\s*20\d{2}|20\d{2})([/–-]|$)", path) or re.search(
                r"20\d{2}\s*[/–-]\s*20\d{2}", path
            ):
                return True
            if any(
                y in path
                for y in [
                    "/2016",
                    "/2017",
                    "/2018",
                    "/2019",
                    "/2020",
                    "/2021",
                    "/2022",
                    "/2023",
                    "/2024",
                    "/2025",
                ]
            ):
                return True
            if any(
                k in t for k in ["read more", "download", "report", "audit", "view"]
            ):
                return True
            if any(k in t for k in card_terms):
                return True
            if any(p in path for p in known_paths):
                return True
            return False

        def extract_year(text: str) -> Optional[str]:
            tl = (text or "").lower()
            m = re.search(r"fy\s*([0-9]{4}\s*[-/–]\s*[0-9]{4})", tl)
            if m:
                return m.group(1).replace(" ", "")
            m2 = re.search(r"(20[0-9]{2})", tl)
            return m2.group(1) if m2 else None

        def best_title_for_link(a_tag: Any, fallback_url: str) -> str:
            text = (a_tag.get_text(strip=True) or "").strip()
            if text and text.lower() != "download" and len(text) > 2:
                return text
            containers = list(a_tag.parents)
            for c in containers[:6]:
                head = None
                if hasattr(c, "find"):
                    head = (
                        c.find(
                            class_=re.compile(
                                r"(entry-title|post__title|uael-post__title|elementor-post__title)"
                            )
                        )
                        or c.find(["h1", "h2", "h3", "h4"])
                        or None
                    )
                if head:
                    t = (head.get_text(strip=True) or "").strip()
                    if t:
                        return t
            return (
                Path(urlparse(fallback_url).path).name.replace("-", " ") or "Download"
            )

        while q and pages < max_pages:
            item = q.popleft()
            url = item["url"]
            if url in seen_pages:
                continue
            seen_pages.add(url)
            soup = self._fetch_html(url, "oag")
            if not soup:
                continue
            pages += 1

            # Collect PDFs on page
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not is_http_link(href):
                    continue
                if not re.search(r"\.pdf($|\?)", href, re.I):
                    continue
                resolved = self._resolve_url(href, base)
                if not same_host(resolved):
                    continue
                # Skip obviously broken or non-audit-like files by path heuristics
                path_lower = (urlparse(resolved).path or "").lower()
                if any(x in path_lower for x in ["/wp-json/", "/feed/", "/tag/"]):
                    continue
                title = best_title_for_link(a, resolved)
                collected.append(
                    {
                        "url": resolved,
                        "title": title,
                        "source": source["name"],
                        "source_key": "oag",
                        "doc_type": "audit",
                        "discovered_date": datetime.now().isoformat(),
                        "meta": {
                            "level": item.get("level"),
                            "breadcrumbs": item.get("breadcrumbs", []),
                            "year": extract_year(title),
                        },
                    }
                )

            # Enqueue deeper pages (cards, categories, read-more)
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not is_http_link(href):
                    continue
                text = a.get_text(strip=True) or ""
                resolved = self._resolve_url(href, base)
                if not same_host(resolved):
                    continue
                if resolved in seen_pages:
                    continue
                if text.lower() in generic_nav:
                    continue
                # Avoid enqueuing direct file links (pdfs) as pages
                if re.search(r"\.(pdf|xlsx?|csv|docx?|zip)($|\?)", resolved, re.I):
                    continue
                if should_enqueue(resolved, text):
                    crumbs = item.get("breadcrumbs", [])
                    t = text.strip()
                    if t and len(t) > 2 and t.lower() not in generic_nav:
                        if not crumbs or crumbs[-1].lower() != t.lower():
                            new_crumbs = (crumbs + [t])[-6:]
                        else:
                            new_crumbs = crumbs
                    else:
                        seg = [
                            s for s in (urlparse(resolved).path or "").split("/") if s
                        ]
                        fallback = seg[-1].replace("-", " ") if seg else ""
                        new_crumbs = (crumbs + ([fallback] if fallback else []))[-6:]
                    q.append(
                        {
                            "url": resolved,
                            "level": item.get("level"),
                            "breadcrumbs": new_crumbs,
                        }
                    )

        unique: Dict[str, Dict[str, Any]] = {}
        for d in collected:
            unique.setdefault(d["url"], d)
        return list(unique.values())

    def _discover_cob(self) -> List[Dict[str, Any]]:
        """Discover COB reports/templates from the exact sections; robust to slow/SSL issues."""
        source = self.kenya_sources["cob"]
        base = source["base_url"]
        host = urlparse(base).netloc.replace("www.", "")

        # Focus on exact National and Consolidated County BIRR pages with deep lists
        sections = [
            # County consolidated BIRR (deep history, back to ~2014)
            "https://cob.go.ke/reports/consolidated-county-budget-implementation-review-reports/",
            # National government BIRR
            "https://cob.go.ke/reports/national-government-budget-implementation-review-reports/",
            # Generic reports index as a safety net
            urljoin(base + "/", "/reports/"),
            # Some legacy paths may 404; keep but don't rely on them
            urljoin(base + "/", "/category/reports/"),
            source.get("reports_url") or urljoin(base + "/", "/reports/"),
        ]

        q = deque([{"url": u, "breadcrumbs": ["reports"]} for u in sections])
        # Paginate both consolidated county and national government sections more deeply
        for idx in [0, 1]:
            for i in range(2, 21):
                q.append(
                    {
                        "url": sections[idx].rstrip("/") + f"/page/{i}/",
                        "breadcrumbs": ["reports", f"page {i}"],
                    }
                )
        # Paginate the generic /reports/ index as well
        for i in range(2, 21):
            q.append(
                {
                    "url": sections[2].rstrip("/") + f"/page/{i}/",
                    "breadcrumbs": ["reports", f"page {i}"],
                }
            )

        seen: set[str] = set()
        collected: List[Dict[str, Any]] = []
        max_pages = 800
        pages = 0

        def same_host(u: str) -> bool:
            try:
                p = urlparse(u)
            except Exception:
                return False
            return (
                p.scheme in ("http", "https") and p.netloc.replace("www.", "") == host
            )

        def is_http_link(h: str) -> bool:
            if not h:
                return False
            h = h.strip().lower()
            if h.startswith(("#", "mailto:", "tel:", "javascript:")):
                return False
            return True

        def looks_like_download(u: str) -> bool:
            ul = (u or "").lower()
            return bool(
                re.search(r"\.(pdf|xlsx?|csv|docx?|zip)($|\?)", ul, re.I)
                or "/download/" in ul
                or "mdocs-file=" in ul  # WP Memorable Docs plugin style
                or "wpdmpro=" in ul  # WP Download Manager
                or "/wp-content/uploads/" in ul
            )

        def looks_like_list(resolved: str, text: str) -> bool:
            path = (urlparse(resolved).path or "").lower()
            t = (text or "").lower()
            if any(
                k in path
                for k in [
                    "/reports/",
                    "/category/",
                    "/news/",
                    "/updates/",
                    "/tag/",
                    "/page/",
                ]
            ):
                return True
            if any(
                k in t
                for k in [
                    "report",
                    "budget",
                    "implementation",
                    "birr",
                    "read more",
                    "view",
                ]
            ):
                return True
            # enqueue year-like slugs
            if re.search(r"20\d{2}", path):
                return True
            return False

        while q and pages < max_pages:
            item = q.popleft()
            url = item["url"]
            if url in seen:
                continue
            seen.add(url)
            soup = self._fetch_html(url, "cob")
            if not soup:
                continue
            pages += 1

            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not is_http_link(href):
                    continue
                resolved = self._resolve_url(href, base)
                if not same_host(resolved):
                    continue
                text = (a.get_text(strip=True) or "").strip()
                if looks_like_download(resolved) or text.lower().startswith("download"):
                    collected.append(
                        {
                            "url": resolved,
                            "title": text or Path(urlparse(resolved).path).name,
                            "source": source["name"],
                            "source_key": "cob",
                            "doc_type": "report",
                            "discovered_date": datetime.now().isoformat(),
                            "meta": {"breadcrumbs": item.get("breadcrumbs", [])},
                        }
                    )
                elif looks_like_list(resolved, text):
                    if resolved not in seen:
                        q.append(
                            {
                                "url": resolved,
                                "breadcrumbs": item.get("breadcrumbs", [])
                                + [text or Path(urlparse(resolved).path).name],
                            }
                        )

        # Attempt to augment via sitemap(s) recursively
        visited_sm: set[str] = set()

        def _collect_from_sitemap(sm_url: str, depth: int = 0) -> None:
            if depth > 3 or not sm_url or sm_url in visited_sm:
                return
            visited_sm.add(sm_url)
            try:
                resp = self.http.get(sm_url, timeout=30)
                resp.raise_for_status()
                root = ET.fromstring(resp.content)
            except Exception:
                return

            tag = (root.tag or "").lower()
            if tag.endswith("sitemapindex"):
                for loc in root.findall(".//{*}sitemap/{*}loc"):
                    nxt = (loc.text or "").strip()
                    if nxt:
                        _collect_from_sitemap(nxt, depth + 1)
                return

            for loc in root.findall(".//{*}url/{*}loc"):
                u = (loc.text or "").strip()
                if not u:
                    continue
                try:
                    pu = urlparse(u)
                except Exception:
                    continue
                if pu.netloc.replace("www.", "") != host:
                    continue
                # If the sitemap links directly to files, take them.
                if (
                    re.search(r"\.(pdf|xlsx?|csv|docx?|zip)($|\?)", u, re.I)
                    or "/download/" in u
                ):
                    collected.append(
                        {
                            "url": u,
                            "title": Path(pu.path).name,
                            "source": source["name"],
                            "source_key": "cob",
                            "doc_type": "report",
                            "discovered_date": datetime.now().isoformat(),
                            "meta": {"breadcrumbs": ["sitemap"]},
                        }
                    )
                    return
                # Otherwise, many WP sitemaps list attachment pages. Fetch page and extract file links
                soup = self._fetch_html(u, "cob")
                if not soup:
                    continue
                for f in self._resolve_pdfs_on_page(soup, base):
                    collected.append(
                        {
                            "url": f,
                            "title": Path(urlparse(f).path).name,
                            "source": source["name"],
                            "source_key": "cob",
                            "doc_type": "report",
                            "discovered_date": datetime.now().isoformat(),
                            "meta": {"breadcrumbs": ["sitemap", u]},
                        }
                    )

        for sm in [
            urljoin(base + "/", "/sitemap_index.xml"),
            urljoin(base + "/", "/sitemap.xml"),
            urljoin(base + "/", "/wp-sitemap.xml"),  # WP 5.5+ default
        ]:
            _collect_from_sitemap(sm)

        # Attempt to augment via WordPress REST API for media (PDFs/XLS etc.)
        def _collect_from_wp_rest() -> None:
            endpoints = [
                # Core media endpoint
                urljoin(base + "/", "/wp-json/wp/v2/media"),
            ]
            exts = [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel",
                "text/csv",
                "application/zip",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ]
            per_page = 100
            for ep in endpoints:
                for mime in exts:
                    page = 1
                    while page <= 20:
                        try:
                            resp = self.http.get(
                                ep,
                                params={
                                    "per_page": per_page,
                                    "page": page,
                                    "mime_type": mime,
                                },
                                timeout=30,
                            )
                            if (
                                resp.status_code == 400
                                and "mime_type" in resp.text.lower()
                            ):
                                # Some WP versions use 'media_type=file' and filter via search; try without mime filter
                                alt = self.http.get(
                                    ep,
                                    params={
                                        "per_page": per_page,
                                        "page": page,
                                        "media_type": "file",
                                    },
                                    timeout=30,
                                )
                                resp = alt
                            resp.raise_for_status()
                            arr = resp.json()
                        except Exception:
                            break
                        if not isinstance(arr, list) or not arr:
                            break
                        for it in arr:
                            try:
                                src = it.get("source_url") or ""
                                if not src:
                                    continue
                                pu = urlparse(src)
                                if pu.netloc.replace("www.", "") != host:
                                    continue
                                if not re.search(
                                    r"\.(pdf|xlsx?|csv|docx?|zip)($|\?)", src, re.I
                                ):
                                    continue
                                title = (
                                    (it.get("title") or {}).get("rendered")
                                    if isinstance(it.get("title"), dict)
                                    else it.get("title")
                                ) or Path(pu.path).name
                                collected.append(
                                    {
                                        "url": src,
                                        "title": title,
                                        "source": source["name"],
                                        "source_key": "cob",
                                        "doc_type": "report",
                                        "discovered_date": datetime.now().isoformat(),
                                        "meta": {"breadcrumbs": ["wp-json"]},
                                    }
                                )
                            except Exception:
                                continue
                        page += 1

        _collect_from_wp_rest()

        # Dedupe
        uniq: Dict[str, Dict[str, Any]] = {}
        for d in collected:
            uniq.setdefault(d["url"], d)
        return list(uniq.values())

    def _discover_treasury(self) -> List[Dict[str, Any]]:
        source = self.kenya_sources["treasury"]
        base = source["base_url"]

        # High-value sections reported by user
        seeds = [
            "https://www.treasury.go.ke/annual-borrowing-plan/",
            "https://www.treasury.go.ke/quarterly-economic-budgetary-review-qebr/",
        ]

        # Also crawl the parent categories these pages live under to find neighboring years
        extra_seeds = [
            "https://www.treasury.go.ke/category/economy/debt-management/",
            "https://www.treasury.go.ke/category/budget/quarterly-economic-and-budgetary-review/",
        ]

        q = deque([{"url": u, "breadcrumbs": []} for u in seeds + extra_seeds])
        # Paginated lists (common on WP):
        for u in extra_seeds:
            for i in range(2, 8):
                q.append({"url": u.rstrip("/") + f"/page/{i}/", "breadcrumbs": []})

        seen_pages: set[str] = set()
        collected: List[Dict[str, Any]] = []
        max_pages = 300
        pages = 0

        def same_host(u: str) -> bool:
            try:
                p = urlparse(u)
            except Exception:
                return False
            return p.netloc.replace("www.", "") in {"treasury.go.ke"}

        def is_http_link(h: str) -> bool:
            if not h:
                return False
            h = h.strip().lower()
            if h.startswith(("#", "mailto:", "tel:", "javascript:")):
                return False
            return True

        def classify(title: str) -> str:
            t = (title or "").lower()
            if "circular" in t or "circulars" in t:
                return "circular"
            if (
                "borrowing plan" in t
                or "annual borrowing plan" in t
                or "abp" in t
                or "debt" in t
            ):
                return "debt"
            if "qebr" in t or "quarterly economic" in t or "quarterly budgetary" in t:
                return "report"
            if "budget" in t or "bps" in t or "policy statement" in t:
                return "budget"
            return "report"

        def extract_year(text: str) -> Optional[str]:
            tl = (text or "").lower()
            m = re.search(r"fy\s*([0-9]{4}\s*[-/–]\s*[0-9]{4})", tl)
            if m:
                return m.group(1).replace(" ", "")
            m2 = re.search(r"(20[0-9]{2})", tl)
            return m2.group(1) if m2 else None

        def looks_like_list_link(url: str, text: str) -> bool:
            path = (urlparse(url).path or "").lower()
            t = (text or "").lower()
            if any(k in path for k in ["/category/", "/tag/", "/page/"]):
                return True
            if any(
                k in t
                for k in [
                    "previous years",
                    "older posts",
                    "qebr",
                    "borrowing",
                    "debt",
                    "budget",
                ]
            ):
                return True
            # Left side menu links live under the same host and often without file extensions
            return not re.search(r"\.(pdf|xlsx?|csv|docx?|zip)($|\?)", path, re.I)

        # Exclusion terms to drop tenders/adverts/press and similar noise
        exclude_terms = {
            "tender",
            "advert",
            "vacancy",
            "recruitment",
            "procurement",
            "eoi",
            "rfq",
            "rfp",
            "press release",
            "media release",
            "speech",
            "obituary",
            "appointment",
        }

        while q and pages < max_pages:
            item = q.popleft()
            url = item["url"]
            if url in seen_pages:
                continue
            seen_pages.add(url)
            soup = self._fetch_html(url, "treasury")
            if not soup:
                continue
            pages += 1

            # Collect file links on page
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not is_http_link(href):
                    continue
                if not re.search(r"\.(pdf|xlsx?|csv|docx?|zip)($|\?)", href, re.I):
                    continue
                resolved = self._resolve_url(href, base)
                if not same_host(resolved):
                    continue
                title = a.get_text(strip=True) or Path(urlparse(resolved).path).name
                lt = (title or "").lower()
                lp = (resolved or "").lower()
                if any(term in lt or term in lp for term in exclude_terms):
                    continue
                collected.append(
                    {
                        "url": resolved,
                        "title": title,
                        "source": source["name"],
                        "source_key": "treasury",
                        "doc_type": classify(title),
                        "discovered_date": datetime.now().isoformat(),
                        "meta": {
                            "breadcrumbs": item.get("breadcrumbs", []),
                            "year": extract_year(title),
                        },
                    }
                )

            # Enqueue deeper listing/category/menu links
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not is_http_link(href):
                    continue
                resolved = self._resolve_url(href, base)
                if not same_host(resolved):
                    continue
                text = a.get_text(strip=True) or ""
                if looks_like_list_link(resolved, text):
                    if resolved not in seen_pages:
                        crumbs = item.get("breadcrumbs", [])
                        label = text or Path(urlparse(resolved).path).name
                        q.append(
                            {
                                "url": resolved,
                                "breadcrumbs": (crumbs + [label])[-6:],
                            }
                        )

        # Dedupe
        uniq: Dict[str, Dict[str, Any]] = {}
        for d in collected:
            uniq.setdefault(d["url"], d)
        return list(uniq.values())

    def _s3_key_for(self, source_key: str, md5_hash: str, filename: str) -> str:
        return f"documents/{source_key}/{md5_hash[:2]}/{md5_hash}/{filename}"

    def _maybe_upload_to_s3(
        self, file_path: Path, md5_hash: str, source_key: str, content_type: str
    ) -> Optional[str]:
        if not self.s3 or not self.s3_bucket:
            return None
        key = self._s3_key_for(source_key, md5_hash, file_path.name)
        try:
            # Check existence
            try:
                self.s3.head_object(Bucket=self.s3_bucket, Key=key)
                return key  # already present
            except ClientError:
                pass
            extra_args = {"ContentType": content_type} if content_type else {}
            self.s3.upload_file(
                str(file_path), self.s3_bucket, key, ExtraArgs=extra_args
            )
            return key
        except Exception:
            return None

    def select_treasury_batch(self, docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Select a small batch from Treasury: latest 10 QEBR + 3 ABP + 5 Circulars.
        Uses title heuristics to detect FY and quarter ordering.
        """

        def year_key(title: str) -> int:
            t = (title or "").lower()
            m = re.search(r"(20\d{2})\s*[/–-]\s*(20\d{2})", t)
            if m:
                try:
                    return int(m.group(1)) * 100 + int(m.group(2))
                except Exception:
                    pass
            m2 = re.search(r"(20\d{2})", t)
            return int(m2.group(1)) if m2 else 0

        def quarter_rank(title: str) -> int:
            t = (title or "").lower()
            if "q4" in t or "4th quarter" in t:
                return 4
            if "q3" in t or "3rd quarter" in t:
                return 3
            if (
                "q2" in t
                or "2nd quarter" in t
                or "1st half" in t
                or "first half" in t
                or "half year" in t
            ):
                return 2
            if "q1" in t or "1st quarter" in t:
                return 1
            return 0

        qebr = [
            d
            for d in docs
            if re.search(r"qebr|quarterly\s+economic", (d.get("title") or ""), re.I)
        ]
        abp = [
            d
            for d in docs
            if re.search(
                r"annual\s+borrowing\s+plan|\babp\b", (d.get("title") or ""), re.I
            )
        ]
        circs = [
            d for d in docs if re.search(r"circular", (d.get("title") or ""), re.I)
        ]

        qebr_sorted = sorted(
            qebr,
            key=lambda d: (
                year_key(d.get("title", "")),
                quarter_rank(d.get("title", "")),
            ),
            reverse=True,
        )
        abp_sorted = sorted(
            abp, key=lambda d: year_key(d.get("title", "")), reverse=True
        )
        circ_sorted = sorted(
            circs, key=lambda d: year_key(d.get("title", "")), reverse=True
        )

        return qebr_sorted[:10] + abp_sorted[:3] + circ_sorted[:5]

    def _classify_document_type(self, title: str) -> str:
        """Classify document type based on title"""
        title_lower = title.lower()

        if any(word in title_lower for word in ["audit", "auditor"]):
            return "audit"
        elif any(word in title_lower for word in ["budget", "allocation"]):
            return "budget"
        elif any(
            word in title_lower for word in ["implementation", "review", "expenditure"]
        ):
            return "report"
        elif any(word in title_lower for word in ["debt", "loan", "borrowing"]):
            return "loan"
        else:
            return "other"

    def _resolve_url(self, href: str, base_url: str) -> str:
        """Convert relative URLs to absolute"""
        try:
            return urljoin(base_url if base_url else "", href)
        except Exception:
            # fallback to previous simple rules
            if href.startswith("http"):
                return href
            elif href.startswith("//"):
                return f"https:{href}"
            elif href.startswith("/"):
                return f"{base_url}{href}"
            else:
                return f"{base_url}/{href}"

    def discover_budget_documents(
        self, source_key: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Public discovery API used by backend: returns discovered docs for a given source or all."""
        keys = [source_key] if source_key else ["treasury", "cob", "oag"]
        out: List[Dict[str, Any]] = []
        for k in keys:
            if k == "treasury":
                out.extend(self._discover_treasury())
            elif k == "cob":
                out.extend(self._discover_cob())
            elif k == "oag":
                out.extend(self._discover_oag())
        return out

    async def download_and_process_document(
        self, doc_info: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Download and process a single document"""
        try:
            # If URL looks like an HTML landing page (no direct file extension), try to resolve to a file link
            url = doc_info["url"]
            if not re.search(r"\.(pdf|xlsx?|csv|docx?|zip)($|\?)", url, re.I):
                soup = self._fetch_html(url, doc_info.get("source_key", ""))
                if soup:
                    pdfs = self._resolve_pdfs_on_page(
                        soup,
                        self.kenya_sources.get(doc_info.get("source_key", ""), {}).get(
                            "base_url", ""
                        ),
                    )
                    if pdfs:
                        url = pdfs[0]
                        doc_info["url"] = url

            # Download the document (with SSL fallback for OAG/COB)
            if doc_info.get("source_key") in {"oag", "cob"}:
                try:
                    response = self.http.get(url, timeout=60)
                    response.raise_for_status()
                except Exception:
                    response = self.http.get(url, timeout=60, verify=False)
                    response.raise_for_status()
            else:
                response = self.http.get(url, timeout=60)
            response.raise_for_status()

            content = response.content
            md5_hash = hashlib.md5(content).hexdigest()

            # Skip if already processed (cache manifest)
            cached = self.processed_manifest.get("by_md5", {}).get(md5_hash)
            if cached:
                return {
                    "document_id": cached.get("document_id"),
                    "file_path": cached.get("file_path"),
                    "extraction_result": {},
                    "normalized_data": [],
                    "skipped": True,
                }

            # Save to local storage with a robust filename
            url_path_name = Path(urlparse(url).path).name
            # Try to infer filename from headers when missing
            cd = response.headers.get("content-disposition", "")
            guessed = None
            if "filename=" in cd:
                guessed = cd.split("filename=")[-1].strip("\"' ")
            if not url_path_name and guessed:
                url_path_name = guessed
            if not url_path_name:
                # fallback default
                url_path_name = (
                    "document.pdf"
                    if "pdf" in response.headers.get("content-type", "").lower()
                    else "document.bin"
                )
            filename = f"{doc_info['source_key']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{url_path_name}"
            file_path = self.storage_path / filename

            with open(file_path, "wb") as f:
                f.write(content)

            logger.info(f"Downloaded: {doc_info['title']} -> {file_path}")

            # Optional: upload to S3-compatible storage
            s3_key = self._maybe_upload_to_s3(
                file_path,
                md5_hash,
                doc_info.get("source_key", "unknown"),
                response.headers.get("content-type", "application/octet-stream"),
            )

            # Extract structured data from PDF
            extraction_result = self.extractor.extract_with_fallback(str(file_path))

            # Prepare document record for database
            document_record = {
                "title": doc_info["title"],
                "url": doc_info["url"],
                "file_path": str(file_path),
                "publisher": doc_info["source"],
                "doc_type": doc_info["doc_type"],
                "fetch_date": datetime.now(),
                "md5": md5_hash,
                "country_id": 1,  # Kenya
                "metadata": {
                    "file_size": len(content),
                    "source_key": doc_info["source_key"],
                    "extraction_confidence": extraction_result.get("confidence", 0),
                    "report_meta": doc_info.get("meta"),
                    "storage": {"s3_key": s3_key} if s3_key else {},
                },
            }

            # Route by document type
            if doc_info["doc_type"] == "audit":
                # Parse audit findings
                findings = self.audit_parser.parse(
                    extraction_result,
                    {"title": doc_info["title"], "file_path": str(file_path)},
                )
                doc_id = await self.db_loader.load_audit_findings_document(
                    document_record, findings
                )
                # For return payload consistency
                normalized_data = [{"_kind": "audit_finding", **f} for f in findings]
            else:
                # Normalize tabular data for budgets/reports
                normalized_data = self.normalizer.normalize_extracted_data(
                    extraction_result, doc_info["source_key"], doc_info["doc_type"]
                )
                doc_id = await self.db_loader.load_document(
                    document_record, normalized_data
                )

            # Update manifest
            self.processed_manifest.setdefault("by_md5", {})[md5_hash] = {
                "document_id": doc_id,
                "file_path": str(file_path),
                "url": doc_info["url"],
                "title": doc_info["title"],
                "source": doc_info["source"],
                "doc_type": doc_info["doc_type"],
                "fetched": datetime.now().isoformat(),
                "s3_key": s3_key,
            }
            self._save_manifest()

            return {
                "document_id": doc_id,
                "file_path": str(file_path),
                "extraction_result": extraction_result,
                "normalized_data": normalized_data,
            }

        except Exception as e:
            logger.error(f"Error processing document {doc_info['url']}: {e}")
            return None

    async def run_full_pipeline(self) -> Dict[str, Any]:
        """Run the complete data ingestion pipeline for Kenya MVP"""
        pipeline_results = {
            "start_time": datetime.now().isoformat(),
            "sources_processed": {},
            "total_documents": 0,
            "successful_extractions": 0,
            "errors": [],
        }

        # Process each major source
        for source_key in ["treasury", "cob", "oag"]:
            logger.info(f"Processing source: {source_key}")

            try:
                # Discover documents
                discovered_docs = self.discover_budget_documents(source_key)

                source_results = {
                    "discovered": len(discovered_docs),
                    "processed": 0,
                    "successful": 0,
                    "documents": [],
                }

                # Process each document (limit to recent ones for MVP)
                recent_docs = discovered_docs[:5]  # Limit to 5 most recent per source

                for doc_info in recent_docs:
                    result = await self.download_and_process_document(doc_info)
                    source_results["processed"] += 1

                    if result:
                        source_results["successful"] += 1
                        source_results["documents"].append(result["document_id"])
                        pipeline_results["successful_extractions"] += 1

                    # Rate limiting - be respectful to government servers
                    await asyncio.sleep(2)

                pipeline_results["sources_processed"][source_key] = source_results
                pipeline_results["total_documents"] += source_results["processed"]

            except Exception as e:
                error_msg = f"Error processing source {source_key}: {e}"
                logger.error(error_msg)
                pipeline_results["errors"].append(error_msg)

        pipeline_results["end_time"] = datetime.now().isoformat()

        # Save pipeline results
        results_file = (
            self.storage_path
            / f"pipeline_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        with open(results_file, "w") as f:
            json.dump(pipeline_results, f, indent=2, default=str)

        logger.info(f"Pipeline completed. Results saved to {results_file}")
        return pipeline_results


if __name__ == "__main__":
    pipeline = KenyaDataPipeline()
    results = asyncio.run(pipeline.run_full_pipeline())
    print(
        f"Pipeline completed: {results['successful_extractions']}/{results['total_documents']} documents processed successfully"
    )
