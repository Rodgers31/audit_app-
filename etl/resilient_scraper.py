"""Resilient web scraper with retry logic and multiple strategies."""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


class ScraperError(Exception):
    """Base exception for scraper errors."""

    pass


class RateLimitError(ScraperError):
    """Raised when rate limit is hit."""

    pass


class ResilientScraper:
    """Web scraper with multiple strategies and retry logic."""

    def __init__(
        self,
        max_retries: int = 3,
        timeout: int = 30,
        user_agents: List[str] = None,
    ):
        self.max_retries = max_retries
        self.timeout = timeout
        self.user_agents = user_agents or [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        ]
        self.current_ua_index = 0

    def _get_user_agent(self) -> str:
        """Rotate user agents."""
        ua = self.user_agents[self.current_ua_index]
        self.current_ua_index = (self.current_ua_index + 1) % len(self.user_agents)
        return ua

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPError, RateLimitError)),
    )
    async def fetch_url(self, url: str) -> str:
        """Fetch URL with retry logic and exponential backoff."""
        headers = {
            "User-Agent": self._get_user_agent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, headers=headers, follow_redirects=True)

                # Check for rate limiting
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After", "60")
                    logger.warning(f"Rate limited. Retry after {retry_after}s")
                    raise RateLimitError(f"Rate limit hit. Retry after {retry_after}s")

                response.raise_for_status()
                return response.text

            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error fetching {url}: {e}")
                raise
            except httpx.RequestError as e:
                logger.error(f"Request error fetching {url}: {e}")
                raise

    async def extract_with_css(self, html: str, selector: str) -> List[Dict[str, Any]]:
        """Extract data using CSS selectors."""
        try:
            soup = BeautifulSoup(html, "html.parser")
            elements = soup.select(selector)

            results = []
            for elem in elements:
                results.append(
                    {
                        "text": elem.get_text(strip=True),
                        "href": elem.get("href"),
                        "attributes": dict(elem.attrs),
                    }
                )

            logger.info(f"CSS extraction found {len(results)} elements")
            return results

        except Exception as e:
            logger.error(f"CSS extraction failed: {e}")
            return []

    async def extract_with_xpath(self, html: str, xpath: str) -> List[Dict[str, Any]]:
        """Extract data using XPath (fallback strategy)."""
        try:
            from lxml import etree
            from lxml import html as lxml_html

            tree = lxml_html.fromstring(html)
            elements = tree.xpath(xpath)

            results = []
            for elem in elements:
                if isinstance(elem, str):
                    results.append({"text": elem})
                else:
                    results.append(
                        {
                            "text": elem.text_content().strip(),
                            "attributes": dict(elem.attrib),
                        }
                    )

            logger.info(f"XPath extraction found {len(results)} elements")
            return results

        except ImportError:
            logger.warning("lxml not available for XPath extraction")
            return []
        except Exception as e:
            logger.error(f"XPath extraction failed: {e}")
            return []

    async def extract_multi_strategy(
        self,
        url: str,
        css_selector: str = None,
        xpath: str = None,
    ) -> List[Dict[str, Any]]:
        """Try multiple extraction strategies until one succeeds."""
        html = await self.fetch_url(url)

        # Try CSS selector first
        if css_selector:
            results = await self.extract_with_css(html, css_selector)
            if results:
                return results
            logger.info("CSS extraction returned no results, trying XPath")

        # Try XPath as fallback
        if xpath:
            results = await self.extract_with_xpath(html, xpath)
            if results:
                return results
            logger.info("XPath extraction returned no results")

        # If both failed, return empty
        logger.warning(f"All extraction strategies failed for {url}")
        return []

    async def download_file(self, url: str, max_size_mb: int = 100) -> Optional[bytes]:
        """Download file with size limit and retry logic."""
        max_size_bytes = max_size_mb * 1024 * 1024

        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=2, max=10),
        )
        async def _download():
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()

                    # Check content length
                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > max_size_bytes:
                        raise ScraperError(f"File too large: {content_length} bytes")

                    # Download in chunks
                    content = b""
                    async for chunk in response.aiter_bytes():
                        content += chunk
                        if len(content) > max_size_bytes:
                            raise ScraperError(
                                "File size exceeded limit during download"
                            )

                    return content

        try:
            return await _download()
        except Exception as e:
            logger.error(f"File download failed: {e}")
            return None

    async def respectful_crawl(self, urls: List[str], delay: float = 1.0) -> List[str]:
        """Crawl multiple URLs with politeness delay."""
        results = []

        for url in urls:
            try:
                content = await self.fetch_url(url)
                results.append(content)

                # Respectful delay between requests
                if len(results) < len(urls):
                    await asyncio.sleep(delay)

            except Exception as e:
                logger.error(f"Failed to crawl {url}: {e}")
                results.append(None)

        return results
