import hashlib
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from source_registry import registry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DocumentDownloader:
    """Downloads documents from government sources."""

    def __init__(self, storage_path: str = "downloads"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(exist_ok=True)

    def calculate_md5(self, content: bytes) -> str:
        """Calculate MD5 hash of content."""
        return hashlib.md5(content).hexdigest()

    def download_file(self, url: str, source_id: str) -> Optional[Dict]:
        """Download a single file and return metadata."""
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            content = response.content
            md5_hash = self.calculate_md5(content)

            # Create filename from URL and timestamp
            parsed_url = urlparse(url)
            filename = f"{source_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{Path(parsed_url.path).name}"
            file_path = self.storage_path / filename

            # Save file
            with open(file_path, "wb") as f:
                f.write(content)

            logger.info(f"Downloaded {url} to {file_path}")

            return {
                "url": url,
                "file_path": str(file_path),
                "md5": md5_hash,
                "fetch_date": datetime.now(),
                "size": len(content),
                "source_id": source_id,
            }

        except Exception as e:
            logger.error(f"Failed to download {url}: {e}")
            return None

    def scrape_pdf_links(self, base_url: str, selector: str) -> List[str]:
        """Scrape PDF links from a webpage."""
        try:
            response = requests.get(base_url, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "html.parser")
            links = []

            for link in soup.select(selector):
                href = link.get("href")
                if href:
                    # Convert relative URLs to absolute
                    full_url = urljoin(base_url, href)
                    links.append(full_url)

            logger.info(f"Found {len(links)} PDF links at {base_url}")
            return links

        except Exception as e:
            logger.error(f"Failed to scrape {base_url}: {e}")
            return []

    def run_source(self, source_id: str) -> List[Dict]:
        """Download all documents for a specific source."""
        source = registry.get_source_by_id(source_id)
        if not source:
            logger.error(f"Source {source_id} not found")
            return []

        downloaded_files = []

        fetch_rules = source.get("fetch_rules", {})
        if fetch_rules.get("type") == "html_scraper":
            # Scrape links from HTML page
            selector = fetch_rules.get("selector", 'a[href$=".pdf"]')
            pdf_links = self.scrape_pdf_links(source["url"], selector)

            for pdf_url in pdf_links:
                file_info = self.download_file(pdf_url, source_id)
                if file_info:
                    file_info.update(
                        {
                            "publisher": source["publisher"],
                            "doc_type": source["doc_type"],
                        }
                    )
                    downloaded_files.append(file_info)

        elif fetch_rules.get("type") == "direct_pdf":
            # Direct PDF download
            file_info = self.download_file(source["url"], source_id)
            if file_info:
                file_info.update(
                    {"publisher": source["publisher"], "doc_type": source["doc_type"]}
                )
                downloaded_files.append(file_info)

        return downloaded_files

    def run_country(self, country_code: str) -> List[Dict]:
        """Download all documents for a country."""
        sources = registry.get_sources_by_country(country_code)
        all_downloads = []

        for source in sources:
            source_id = source.get("source_id")
            if source_id:
                downloads = self.run_source(source_id)
                all_downloads.extend(downloads)

        return all_downloads

    def run_all(self) -> Dict[str, List[Dict]]:
        """Download documents for all countries."""
        results = {}

        for country_code in registry.sources.keys():
            results[country_code] = self.run_country(country_code)

        return results


if __name__ == "__main__":
    downloader = DocumentDownloader()

    # Download for Kenya as example
    kenya_downloads = downloader.run_country("KEN")
    print(f"Downloaded {len(kenya_downloads)} documents for Kenya")
