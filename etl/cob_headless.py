"""Headless downloader for COB WordPress Download Manager protected documents.

Uses Playwright (if installed) to resolve dynamic download pages under https://cob.go.ke/download/.
Falls back gracefully if Playwright not available or PLAYWRIGHT_ENABLED env var is not set to a truthy value.
"""

from __future__ import annotations

import asyncio
import os
import re
from typing import List, Optional, Tuple

try:
    from playwright.async_api import async_playwright  # type: ignore
except Exception:  # Playwright optional
    async_playwright = None  # type: ignore

DEFAULT_TIMEOUT_MS = 30000

TRUTHY = {"1", "true", "yes", "on", "enable", "enabled"}


def headless_allowed() -> bool:
    val = os.getenv("PLAYWRIGHT_ENABLED", "0").lower()
    return val in TRUTHY and async_playwright is not None


async def fetch_cob_download(url: str) -> Optional[Tuple[bytes, str]]:
    """Return (bytes, inferred_filename) for a COB download landing page or None.

    Strategy:
    1. Navigate to landing page.
    2. Wait for an element with class .wpdm-download-link or onclick containing wpdmdl.
    3. Intercept the first navigation / download response whose headers indicate a document (pdf, excel, zip, doc).
    4. If no direct download after click, inspect network responses for PDF signature.
    """
    if not headless_allowed():
        return None
    debug = os.getenv("HEADLESS_DEBUG", "0").lower() in TRUTHY
    async with async_playwright() as p:  # type: ignore
        # Try Chromium first, then Firefox
        for btype in [p.chromium, p.firefox]:
            browser = await btype.launch(headless=True)
            try:
                context = await browser.new_context(
                    accept_downloads=True,
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                    ),
                    locale="en-US",
                    timezone_id="Africa/Nairobi",
                    extra_http_headers={
                        "Accept": "*/*",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Cache-Control": "no-cache",
                        "Pragma": "no-cache",
                        "Referer": (
                            url if url.startswith("http") else "https://cob.go.ke"
                        ),
                    },
                )
                page = await context.new_page()
                await page.goto(url, wait_until="load", timeout=DEFAULT_TIMEOUT_MS)
                # allow late-bound JS to attach handlers and requests to settle
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass
                await page.wait_for_timeout(600)
                if debug:
                    try:
                        html0 = await page.content()
                        dump_path = os.path.join(
                            os.path.dirname(os.path.dirname(__file__)),
                            "report_cache",
                            "headless_debug.html",
                        )
                        os.makedirs(os.path.dirname(dump_path), exist_ok=True)
                        with open(dump_path, "w", encoding="utf-8") as f:
                            f.write(html0)
                        print(f"[HEADLESS_DEBUG] Wrote initial HTML to {dump_path}")
                    except Exception:
                        pass

                # Capture binary responses opportunistically
                captured: List[Tuple[bytes, str]] = []
                redirect_candidates: List[str] = []
                debug_log: List[str] = []

                def _is_doc(ct: str) -> bool:
                    ct = (ct or "").lower()
                    return any(
                        x in ct
                        for x in [
                            "pdf",
                            "msword",
                            "wordprocessingml",
                            "excel",
                            "spreadsheet",
                            "zip",
                            "octet-stream",
                        ]
                    )

                def _looks_like_file(body: bytes, ct: str, cd: str) -> bool:
                    if not body:
                        return False
                    if _is_doc(ct):
                        return True
                    if "attachment" in (cd or "").lower():
                        return True
                    # Magic bytes: PDF, ZIP (docx/xlsx), OLE (legacy office)
                    return (
                        body.startswith(b"%PDF")
                        or body.startswith(b"PK\x03\x04")
                        or body.startswith(b"\xd0\xcf\x11\xe0")
                    )

                async def on_response(resp):
                    try:
                        ct = (resp.headers.get("content-type") or "").lower()
                        cd = resp.headers.get("content-disposition") or ""
                        body = await resp.body()
                        if debug and (
                            "wpdm" in resp.url.lower()
                            or "/download/" in resp.url.lower()
                            or "admin-ajax.php" in resp.url.lower()
                            or _is_doc(ct)
                            or "attachment" in cd.lower()
                        ):
                            debug_log.append(
                                f"RESP {resp.status} {resp.url} ct={ct} cd={'yes' if cd else 'no'} len={len(body) if body else 0}"
                            )
                        # Capture redirects to file-like URLs
                        if resp.status in (301, 302, 303, 307, 308):
                            loc = resp.headers.get("location") or ""
                            if loc:
                                from urllib.parse import urljoin

                                target = urljoin(resp.url, loc)
                                tl = target.lower()
                                if any(
                                    re.search(r"\.(pdf|docx?|xlsx?|zip)($|\?)", tl)
                                ) or ("/uploads/" in tl):
                                    redirect_candidates.append(target)
                        if _looks_like_file(body, ct, cd):
                            name = (
                                resp.url.split("/")[-1].split("?")[0] or "document.bin"
                            )
                            captured.append((body, name))
                    except Exception:
                        pass

                context.on("response", lambda r: asyncio.create_task(on_response(r)))

                # Find a download link
                # Accept common cookie banners if present
                for sel in [
                    "#cn-accept",
                    "#cookie_action_close_header",
                    "#wt-cli-accept-all-btn",
                    ".cli-accept-all-btn",
                    "button[aria-label*='accept' i]",
                    "button:has-text('Accept')",
                ]:
                    try:
                        btn = await page.query_selector(sel)
                        if btn:
                            await btn.click()
                            await page.wait_for_timeout(300)
                            break
                    except Exception:
                        continue

                # Try a variety of common WPDM link/button selectors
                link = await page.query_selector(
                    "a.wpdm-download-link, a.wpdm-download-button, button.wpdm-download-link, button.wpdm-button, a:has-text('Download'), button:has-text('Download')"
                )
                if not link:
                    anchors = await page.query_selector_all("a[onclick]")
                    for a in anchors:
                        oc = (await a.get_attribute("onclick")) or ""
                        if "wpdmdl" in oc.lower():
                            link = a
                            break
                # ensure the link is scrolled into view if found later
                if debug and not link:
                    debug_log.append("No explicit download link selector found")

                download_bytes: Optional[bytes] = None
                filename: str = "document.bin"

                async def attempt_click():
                    nonlocal download_bytes, filename
                    if not link:
                        return
                    try:
                        # Prefer grabbing the network response first; some sites stream file
                        def _pred(resp):
                            u = resp.url.lower()
                            ct = (resp.headers.get("content-type") or "").lower()
                            cd = resp.headers.get("content-disposition") or ""
                            return (
                                ("wpdmdl=" in u)
                                or ("/download/" in u)
                                or ("wpdm" in u)
                                or ("admin-ajax.php" in u)
                                or _is_doc(ct)
                                or ("attachment" in cd.lower())
                            )

                        # Bring into view before click to trigger any intersection-observer guarded handlers
                        try:
                            await link.scroll_into_view_if_needed(timeout=1000)
                        except Exception:
                            pass
                        async with page.expect_response(
                            _pred, timeout=20000
                        ) as resp_wait:
                            await link.click()
                        resp = await resp_wait.value
                        ct = (resp.headers.get("content-type") or "").lower()
                        cd = resp.headers.get("content-disposition") or ""
                        body = await resp.body()
                        if _looks_like_file(body, ct, cd):
                            download_bytes = body
                            fn = resp.url.split("/")[-1].split("?")[0]
                            filename = fn or filename
                        elif "json" in ct and body:
                            try:
                                import json

                                data = json.loads(body.decode("utf-8", "ignore"))
                                # Look for a URL in common fields
                                candidates = []
                                if isinstance(data, dict):
                                    for k in ("url", "download_url", "file", "link"):
                                        v = data.get(k)
                                        if isinstance(v, str) and v.startswith("http"):
                                            candidates.append(v)
                                    # scan nested
                                    for v in data.values():
                                        if isinstance(v, str) and v.startswith("http"):
                                            candidates.append(v)
                                if isinstance(data, list):
                                    for it in data:
                                        if isinstance(it, dict):
                                            v = (
                                                it.get("url")
                                                or it.get("download_url")
                                                or it.get("file")
                                                or it.get("link")
                                            )
                                            if isinstance(v, str) and v.startswith(
                                                "http"
                                            ):
                                                candidates.append(v)
                                # Try fetching first plausible candidate
                                for cand in candidates:
                                    r2 = await page.request.get(
                                        cand,
                                        timeout=15000,
                                        headers={"Referer": url, "Accept": "*/*"},
                                    )
                                    ct2 = (r2.headers.get("content-type") or "").lower()
                                    cd2 = r2.headers.get("content-disposition") or ""
                                    b2 = await r2.body()
                                    if _looks_like_file(b2, ct2, cd2):
                                        download_bytes = b2
                                        disp = (
                                            r2.headers.get("content-disposition") or ""
                                        )
                                        mfn = re.search(
                                            r"filename=\"?([^\";]+)\"?", disp
                                        )
                                        if mfn:
                                            filename = mfn.group(1)
                                        else:
                                            filename = (
                                                cand.split("/")[-1].split("?")[0]
                                                or filename
                                            )
                                        break
                            except Exception:
                                pass
                        if download_bytes is None:
                            # Try native download API next
                            async with page.expect_download(timeout=20000) as dl_wait:
                                await link.click()
                            dl = await dl_wait.value
                            path = await dl.path()
                            if path:
                                with open(path, "rb") as f:
                                    download_bytes = f.read()
                                suggested = dl.suggested_filename
                                if suggested:
                                    filename = suggested
                    except Exception:
                        try:
                            await link.click()
                            await page.wait_for_timeout(3000)
                        except Exception:
                            pass

                await attempt_click()

                # Prefer captured network responses if click didn't yield a download
                if download_bytes is None and captured:
                    download_bytes, filename = captured[-1]

                # If still nothing, inspect performance entries for potential file URLs
                if download_bytes is None:
                    pass
                # Try following any redirect candidates captured
                if download_bytes is None and redirect_candidates:
                    for cand in redirect_candidates[-5:]:
                        try:
                            r6 = await page.request.get(
                                cand,
                                timeout=15000,
                                headers={"Referer": url, "Accept": "*/*"},
                            )
                            ct6 = (r6.headers.get("content-type") or "").lower()
                            cd6 = r6.headers.get("content-disposition") or ""
                            b6 = await r6.body()
                            if _looks_like_file(b6, ct6, cd6):
                                download_bytes = b6
                                disp = r6.headers.get("content-disposition") or ""
                                mfn = re.search(r"filename=\"?([^\";]+)\"?", disp)
                                if mfn:
                                    filename = mfn.group(1)
                                else:
                                    filename = (
                                        cand.split("/")[-1].split("?")[0] or filename
                                    )
                                break
                        except Exception:
                            continue
                    try:
                        perf_urls = await page.evaluate(
                            "() => (performance.getEntriesByType('resource')||[]).map(e=>e.name)"
                        )
                        if isinstance(perf_urls, list):
                            for pu in perf_urls[-20:]:  # check recent
                                if not isinstance(pu, str):
                                    continue
                                ul = pu.lower()
                                if any(
                                    x in ul
                                    for x in ["wpdmdl=", "/download/", "/uploads/"]
                                ):
                                    try:
                                        r3 = await page.request.get(
                                            pu,
                                            timeout=15000,
                                            headers={"Referer": url, "Accept": "*/*"},
                                        )
                                        ct3 = (
                                            r3.headers.get("content-type") or ""
                                        ).lower()
                                        cd3 = (
                                            r3.headers.get("content-disposition") or ""
                                        )
                                        b3 = await r3.body()
                                        if _looks_like_file(b3, ct3, cd3):
                                            download_bytes = b3
                                            disp = (
                                                r3.headers.get("content-disposition")
                                                or ""
                                            )
                                            mfn = re.search(
                                                r"filename=\"?([^\";]+)\"?", disp
                                            )
                                            if mfn:
                                                filename = mfn.group(1)
                                            else:
                                                filename = (
                                                    pu.split("/")[-1].split("?")[0]
                                                    or filename
                                                )
                                            break
                                    except Exception:
                                        continue
                    except Exception:
                        pass

                # Scrape HTML for direct uploads URLs as a last-resort heuristic
                if download_bytes is None:
                    try:
                        html = await page.content()
                        for m in re.findall(
                            r"https?://[^\s'\"]+/wp-content/uploads/[^'\"]+\.(pdf|docx?|xlsx?|zip)",
                            html,
                            re.I,
                        ):
                            cand = m[0] if isinstance(m, tuple) else m
                            if not isinstance(cand, str):
                                continue
                            try:
                                r5 = await page.request.get(
                                    cand,
                                    timeout=15000,
                                    headers={"Referer": url, "Accept": "*/*"},
                                )
                                ct5 = (r5.headers.get("content-type") or "").lower()
                                cd5 = r5.headers.get("content-disposition") or ""
                                b5 = await r5.body()
                                if _looks_like_file(b5, ct5, cd5):
                                    download_bytes = b5
                                    disp = r5.headers.get("content-disposition") or ""
                                    mfn = re.search(r"filename=\"?([^\";]+)\"?", disp)
                                    if mfn:
                                        filename = mfn.group(1)
                                    else:
                                        filename = (
                                            cand.split("/")[-1].split("?")[0]
                                            or filename
                                        )
                                    break
                            except Exception:
                                continue
                    except Exception:
                        pass

                # Try direct wpdmdl request if still nothing
                if download_bytes is None:
                    # Try submitting any forms that might produce the link
                    try:
                        forms = await page.query_selector_all("form")
                        for form in forms:
                            action = (await form.get_attribute("action")) or url
                            method = (
                                (await form.get_attribute("method")) or "get"
                            ).lower()
                            if not any(
                                x in (action or "").lower()
                                for x in [
                                    "download",
                                    "wpdm",
                                    "wpdmdl",
                                    "admin-ajax.php",
                                ]
                            ):
                                continue
                            # collect inputs
                            inputs = await form.query_selector_all("input")
                            data = {}
                            for inp in inputs:
                                name = await inp.get_attribute("name")
                                if not name:
                                    continue
                                val = ""
                                try:
                                    # Playwright async ElementHandle has input_value()
                                    val = await inp.input_value()
                                except Exception:
                                    v2 = await inp.get_attribute("value")
                                    val = v2 or ""
                                data[name] = val
                            try:
                                if method == "post":
                                    r9 = await page.request.post(
                                        action,
                                        timeout=15000,
                                        headers={"Referer": url, "Accept": "*/*"},
                                        form=data,
                                    )
                                else:
                                    from urllib.parse import urlencode

                                    q = urlencode(data)
                                    r9 = await page.request.get(
                                        f"{action}?{q}",
                                        timeout=15000,
                                        headers={"Referer": url, "Accept": "*/*"},
                                    )
                                ct9 = (r9.headers.get("content-type") or "").lower()
                                cd9 = r9.headers.get("content-disposition") or ""
                                b9 = await r9.body()
                                if _looks_like_file(b9, ct9, cd9):
                                    download_bytes = b9
                                    disp = r9.headers.get("content-disposition") or ""
                                    mfn = re.search(r"filename=\"?([^\";]+)\"?", disp)
                                    if mfn:
                                        filename = mfn.group(1)
                                    else:
                                        filename = (
                                            action.split("/")[-1].split("?")[0]
                                            or filename
                                        )
                                    break
                            except Exception:
                                continue
                    except Exception:
                        pass

                # Try direct wpdmdl request if still nothing
                if download_bytes is None:
                    ids = set()
                    anchors = await page.query_selector_all("a[href]")
                    for a in anchors:
                        href = (await a.get_attribute("href")) or ""
                        m = re.search(r"wpdmdl=(\d+)", href, re.I)
                        if m:
                            ids.add(m.group(1))
                        # Also check data attributes
                        for attr in ("data-download-url", "data-file", "data-wpdm-url"):
                            dv = (await a.get_attribute(attr)) or ""
                            m2 = re.search(r"wpdmdl=(\d+)", dv, re.I)
                            if m2:
                                ids.add(m2.group(1))
                    # Parse full HTML for hidden occurrences
                    try:
                        html = await page.content()
                        for m in re.findall(r"wpdmdl=(\d+)", html, re.I):
                            ids.add(m)
                    except Exception:
                        pass
                    base_root = "https://cob.go.ke"
                    # also consider current page path (some sites require same path as referer)
                    from urllib.parse import urlparse

                    parsed = urlparse(url)
                    current_path_base = (
                        f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
                    )
                    for _id in ids:
                        trial_variants = [
                            f"{base_root}/?wpdmdl={_id}",
                            f"{current_path_base}/?wpdmdl={_id}",
                            f"{current_path_base}/?wpdmdl={_id}&refresh=1",
                        ]
                        ok = False
                        for trial in trial_variants:
                            try:
                                resp = await page.request.get(
                                    trial,
                                    timeout=15000,
                                    headers={"Referer": url, "Accept": "*/*"},
                                )
                            except Exception:
                                continue
                            ct = (resp.headers.get("content-type") or "").lower()
                            cd = resp.headers.get("content-disposition") or ""
                            body = await resp.body()
                            if _looks_like_file(body, ct, cd):
                                download_bytes = body
                                # filename from content-disposition if present
                                disp = resp.headers.get("content-disposition") or ""
                                mfn = re.search(r"filename=\"?([^\";]+)\"?", disp)
                                if mfn:
                                    filename = mfn.group(1)
                                else:
                                    filename = (
                                        trial.split("/")[-1].split("?")[0] or filename
                                    )
                                ok = True
                                break
                        if ok:
                            break

                # As a last resort, parse onclick location.href
                if download_bytes is None and link:
                    try:
                        oc = (await link.get_attribute("onclick")) or ""
                        m = re.search(r"location\.href=['\"]([^'\"]+)", oc)
                        if m:
                            target = m.group(1)
                            if target.startswith("/"):
                                target = "https://cob.go.ke" + target
                            resp = await page.request.get(
                                target,
                                timeout=15000,
                                headers={"Referer": url, "Accept": "*/*"},
                            )
                            ct = (resp.headers.get("content-type") or "").lower()
                            cd = resp.headers.get("content-disposition") or ""
                            body = await resp.body()
                            if _looks_like_file(body, ct, cd):
                                download_bytes = body
                                filename = (
                                    target.split("/")[-1].split("?")[0] or filename
                                )
                    except Exception:
                        pass

                # WPDM admin-ajax fallback: attempt to derive download URL via AJAX API
                if download_bytes is None:
                    try:
                        html = await page.content()
                        # Find admin-ajax.php
                        from urllib.parse import urljoin

                        m_ajax = re.search(
                            r"[\w:\/\.-]+/wp-admin/admin-ajax\.php", html
                        )
                        ajax_url = (
                            m_ajax.group(0)
                            if m_ajax
                            else urljoin(url, "/wp-admin/admin-ajax.php")
                        )
                        # Find possible package ID and nonce token
                        m_id = re.search(r"wpdmdl=(\d+)", html, re.I) or re.search(
                            r"data-id=\"(\d+)\"", html, re.I
                        )
                        # Nonce may appear as _wpnonce or wpdm_nonce
                        m_nonce = re.search(
                            r"[_-]wpnonce[\"']?\s*[:=]\s*[\"']([A-Za-z0-9]+)[\"']", html
                        ) or re.search(
                            r"wpdm_nonce[\"']?\s*[:=]\s*[\"']([A-Za-z0-9]+)[\"']", html
                        )
                        if ajax_url and m_id and m_nonce:
                            pid = m_id.group(1)
                            nonce = m_nonce.group(1)
                            # Try common executes used by WPDM
                            executes = [
                                "__wpdm_get_download_link",
                                "wpdm_get_download_link",
                                "__wpdm_link",
                                "wpdm_link",
                            ]
                            for ex in executes:
                                try:
                                    r10 = await page.request.post(
                                        ajax_url,
                                        timeout=20000,
                                        headers={"Referer": url, "Accept": "*/*"},
                                        form={
                                            "action": "wpdm_ajax_call",
                                            "execute": ex,
                                            "ID": pid,
                                            "_wpnonce": nonce,
                                        },
                                    )
                                    b10 = await r10.body()
                                    t10 = b10.decode("utf-8", "ignore") if b10 else ""
                                    # Extract a link to uploads or recognized file extension
                                    mlink = re.search(
                                        r"https?://[^\s'\"]+/wp-content/uploads/[^'\"]+\.(pdf|docx?|xlsx?|zip)",
                                        t10,
                                        re.I,
                                    )
                                    if not mlink:
                                        # Sometimes response is HTML with an anchor
                                        mlink = re.search(
                                            r"href=['\"](https?://[^'\"]+\.(?:pdf|docx?|xlsx?|zip))",
                                            t10,
                                            re.I,
                                        )
                                    if mlink:
                                        cand = (
                                            mlink.group(1)
                                            if mlink.groups()
                                            else mlink.group(0)
                                        )
                                        r11 = await page.request.get(
                                            cand,
                                            timeout=20000,
                                            headers={"Referer": url, "Accept": "*/*"},
                                        )
                                        ct11 = (
                                            r11.headers.get("content-type") or ""
                                        ).lower()
                                        cd11 = (
                                            r11.headers.get("content-disposition") or ""
                                        )
                                        b11 = await r11.body()
                                        if _looks_like_file(b11, ct11, cd11):
                                            download_bytes = b11
                                            disp = (
                                                r11.headers.get("content-disposition")
                                                or ""
                                            )
                                            mfn = re.search(
                                                r"filename=\"?([^\";]+)\"?", disp
                                            )
                                            if mfn:
                                                filename = mfn.group(1)
                                            else:
                                                filename = (
                                                    cand.split("/")[-1].split("?")[0]
                                                    or filename
                                                )
                                            break
                                except Exception:
                                    continue
                    except Exception:
                        pass

                await browser.close()
                if debug and not download_bytes:
                    print("\n".join(debug_log))
                if download_bytes:
                    return download_bytes, filename
            except Exception:
                try:
                    await browser.close()
                except Exception:
                    pass
                continue
        # If we reach here, all browser attempts failed
        return None


if __name__ == "__main__":

    async def _t():
        import sys

        u = (
            sys.argv[1]
            if len(sys.argv) > 1
            else "https://cob.go.ke/download/annual-report-for-the-financial-year-2023-2024/"
        )
        res = await fetch_cob_download(u)
        if res:
            print("Downloaded", len(res[0]), "bytes as", res[1])
        else:
            print("Failed to resolve dynamic download")

    asyncio.run(_t())
