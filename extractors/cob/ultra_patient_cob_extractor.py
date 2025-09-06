"""
Ultra-Patient COB Extractor
Designed specifically for the extremely slow COB website
Uses extended timeouts, retry mechanisms, and patience for slow government sites
"""

import json
import logging
import os
import re
import time
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UltraPatientCOBExtractor:
    """Ultra-patient extractor designed for extremely slow COB website."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            }
        )

        # Handle SSL issues
        self.session.verify = False
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        self.base_url = "https://cob.go.ke"
        self.discovered_reports = []
        self.successful_pages = []
        self.failed_pages = []

        # Ultra-patient settings
        self.max_timeout = 180  # 3 minutes per page
        self.retry_attempts = 3
        self.wait_between_retries = 30  # 30 seconds between retries
        self.wait_between_pages = 10  # 10 seconds between pages

        os.makedirs("ultra_patient_reports", exist_ok=True)

    def patient_get(
        self, url: str, description: str = ""
    ) -> Optional[requests.Response]:
        """Ultra-patient GET request with retries and extended timeouts."""
        logger.info(f"🕒 Patient request to: {url}")
        if description:
            logger.info(f"   📋 {description}")

        for attempt in range(self.retry_attempts):
            try:
                logger.info(
                    f"   🔄 Attempt {attempt + 1}/{self.retry_attempts} (timeout: {self.max_timeout}s)"
                )

                start_time = time.time()
                response = self.session.get(url, timeout=self.max_timeout)
                end_time = time.time()

                load_time = end_time - start_time
                logger.info(f"   ✅ Success! Loaded in {load_time:.1f} seconds")

                if response.status_code == 200:
                    self.successful_pages.append(
                        {
                            "url": url,
                            "load_time": load_time,
                            "attempt": attempt + 1,
                            "timestamp": datetime.now().isoformat(),
                        }
                    )
                    return response
                else:
                    logger.warning(
                        f"   ⚠️ Status {response.status_code} on attempt {attempt + 1}"
                    )

            except requests.exceptions.Timeout:
                logger.warning(
                    f"   ⏰ Timeout on attempt {attempt + 1} after {self.max_timeout} seconds"
                )

                if attempt < self.retry_attempts - 1:
                    logger.info(
                        f"   😴 Waiting {self.wait_between_retries}s before retry..."
                    )
                    time.sleep(self.wait_between_retries)

            except Exception as e:
                logger.warning(f"   ❌ Error on attempt {attempt + 1}: {str(e)}")

                if attempt < self.retry_attempts - 1:
                    logger.info(
                        f"   😴 Waiting {self.wait_between_retries}s before retry..."
                    )
                    time.sleep(self.wait_between_retries)

        # All attempts failed
        logger.error(f"   💀 All {self.retry_attempts} attempts failed for {url}")
        self.failed_pages.append(
            {
                "url": url,
                "attempts": self.retry_attempts,
                "timestamp": datetime.now().isoformat(),
            }
        )

        return None

    def extract_ultra_patient_reports(self):
        """Extract reports with ultra-patient approach."""
        logger.info("\n" + "=" * 80)
        logger.info("🕒 ULTRA-PATIENT COB EXTRACTION")
        logger.info("📋 Designed for extremely slow government websites")
        logger.info(
            f"⏱️ Timeout: {self.max_timeout}s | Retries: {self.retry_attempts} | Wait: {self.wait_between_retries}s"
        )
        logger.info("=" * 80)

        start_time = datetime.now()

        # Priority pages to check (based on known working URLs)
        priority_pages = [
            {
                "url": f"{self.base_url}/reports/",
                "description": "Main reports page",
                "priority": 1,
            },
            {
                "url": f"{self.base_url}/reports/consolidated-county-budget-implementation-review-reports/",
                "description": "Consolidated county budget reports",
                "priority": 1,
            },
            {
                "url": f"{self.base_url}/reports/national-government-budget-implementation-review-reports/",
                "description": "National government budget reports",
                "priority": 1,
            },
            {
                "url": f"{self.base_url}/reports/expenditure-templates/",
                "description": "Expenditure templates",
                "priority": 2,
            },
            {
                "url": f"{self.base_url}/reports/financial-reports/",
                "description": "Financial reports",
                "priority": 2,
            },
        ]

        all_reports = []

        for i, page_info in enumerate(priority_pages):
            logger.info(
                f"\n📄 Processing page {i+1}/{len(priority_pages)}: {page_info['description']}"
            )

            response = self.patient_get(page_info["url"], page_info["description"])

            if response:
                page_reports = self._extract_reports_from_response(
                    response, page_info["url"]
                )
                all_reports.extend(page_reports)
                logger.info(f"   📊 Found {len(page_reports)} reports on this page")
            else:
                logger.warning(f"   💀 Failed to load page: {page_info['description']}")

            # Wait between pages to be respectful
            if i < len(priority_pages) - 1:
                logger.info(
                    f"   😴 Waiting {self.wait_between_pages}s before next page..."
                )
                time.sleep(self.wait_between_pages)

        end_time = datetime.now()
        total_duration = (end_time - start_time).total_seconds()

        # Generate summary
        results = {
            "extraction_summary": {
                "total_reports_found": len(all_reports),
                "successful_pages": len(self.successful_pages),
                "failed_pages": len(self.failed_pages),
                "total_duration_seconds": total_duration,
                "average_page_load_time": sum(
                    p["load_time"] for p in self.successful_pages
                )
                / max(1, len(self.successful_pages)),
                "settings": {
                    "max_timeout": self.max_timeout,
                    "retry_attempts": self.retry_attempts,
                    "wait_between_retries": self.wait_between_retries,
                },
                "timestamp": datetime.now().isoformat(),
            },
            "discovered_reports": all_reports,
            "successful_pages": self.successful_pages,
            "failed_pages": self.failed_pages,
            "performance_analysis": self._analyze_performance(),
        }

        return results

    def _extract_reports_from_response(
        self, response: requests.Response, source_url: str
    ) -> List[Dict]:
        """Extract reports from a successful response."""
        reports = []

        try:
            soup = BeautifulSoup(response.content, "html.parser")

            # Method 1: Look for direct PDF/document links
            doc_links = soup.find_all(
                "a", href=re.compile(r"\.(pdf|xlsx?|docx?)$", re.I)
            )

            for link in doc_links:
                href = link.get("href")
                if not href.startswith("http"):
                    href = urljoin(source_url, href)

                title = (
                    link.get_text(strip=True)
                    or link.get("title", "")
                    or href.split("/")[-1]
                )

                report = {
                    "title": title,
                    "url": href,
                    "file_type": href.split(".")[-1].lower(),
                    "source_page": source_url,
                    "discovery_method": "direct_link",
                    "financial_year": self._extract_financial_year(title),
                    "report_category": self._classify_report(title),
                    "discovered_at": datetime.now().isoformat(),
                }

                reports.append(report)
                logger.info(f"      📄 Found: {title[:60]}")

            # Method 2: Look for tables with report listings
            tables = soup.find_all("table")
            for table in tables:
                table_reports = self._extract_table_reports(table, source_url)
                reports.extend(table_reports)

            # Method 3: Look for lists with reports
            lists = soup.find_all(["ul", "ol"])
            for list_elem in lists:
                list_reports = self._extract_list_reports(list_elem, source_url)
                reports.extend(list_reports)

            # Method 4: Extract any embedded data
            page_data = self._extract_page_metadata(soup, source_url)
            if page_data:
                reports.append(page_data)

        except Exception as e:
            logger.error(f"   ❌ Error extracting reports from {source_url}: {str(e)}")

        return reports

    def _extract_table_reports(self, table, source_url: str) -> List[Dict]:
        """Extract reports from table elements."""
        reports = []

        rows = table.find_all("tr")
        for row in rows:
            links = row.find_all("a", href=True)

            for link in links:
                href = link.get("href")
                if any(
                    ext in href.lower() for ext in [".pdf", ".xlsx", ".xls", ".doc"]
                ):
                    full_url = urljoin(source_url, href)

                    # Try to get title from table cells
                    cells = row.find_all(["td", "th"])
                    title = None
                    for cell in cells:
                        cell_text = cell.get_text(strip=True)
                        if cell_text and len(cell_text) > 5:
                            title = cell_text
                            break

                    if not title:
                        title = link.get_text(strip=True) or href.split("/")[-1]

                    report = {
                        "title": title,
                        "url": full_url,
                        "file_type": href.split(".")[-1].lower(),
                        "source_page": source_url,
                        "discovery_method": "table_extraction",
                        "financial_year": self._extract_financial_year(title),
                        "discovered_at": datetime.now().isoformat(),
                    }

                    reports.append(report)
                    logger.info(f"      📊 Table report: {title[:60]}")

        return reports

    def _extract_list_reports(self, list_elem, source_url: str) -> List[Dict]:
        """Extract reports from list elements."""
        reports = []

        items = list_elem.find_all("li")
        for item in items:
            links = item.find_all("a", href=True)

            for link in links:
                href = link.get("href")
                if any(
                    ext in href.lower() for ext in [".pdf", ".xlsx", ".xls", ".doc"]
                ):
                    full_url = urljoin(source_url, href)
                    title = link.get_text(strip=True) or href.split("/")[-1]

                    report = {
                        "title": title,
                        "url": full_url,
                        "file_type": href.split(".")[-1].lower(),
                        "source_page": source_url,
                        "discovery_method": "list_extraction",
                        "financial_year": self._extract_financial_year(title),
                        "discovered_at": datetime.now().isoformat(),
                    }

                    reports.append(report)
                    logger.info(f"      📋 List report: {title[:60]}")

        return reports

    def _extract_page_metadata(self, soup, source_url: str) -> Optional[Dict]:
        """Extract metadata and structured data from the page."""
        try:
            page_text = soup.get_text()

            # Look for financial years mentioned
            years_mentioned = list(set(re.findall(r"20\d{2}(?:-\d{2})?", page_text)))

            # Look for budget/financial mentions
            financial_keywords = re.findall(
                r"(?:budget|expenditure|revenue|allocation|kes)\s*(?:of)?\s*([\d,]+(?:\.\d+)?)\s*(?:billion|million|thousand)?",
                page_text,
                re.I,
            )

            if years_mentioned or financial_keywords:
                return {
                    "title": f"Page Metadata - {source_url.split('/')[-2] or 'reports'}",
                    "url": source_url,
                    "file_type": "metadata",
                    "discovery_method": "page_analysis",
                    "years_mentioned": sorted(years_mentioned, reverse=True),
                    "financial_mentions": financial_keywords[:10],
                    "content_type": "government_budget_data",
                    "discovered_at": datetime.now().isoformat(),
                }

        except Exception as e:
            logger.debug(f"Metadata extraction failed: {e}")

        return None

    def _extract_financial_year(self, text: str) -> str:
        """Extract financial year from text."""
        patterns = [r"FY\s*(20\d{2}[/-]\d{2,4})", r"20\d{2}[/-]\d{2,4}", r"20\d{2}"]

        for pattern in patterns:
            match = re.search(pattern, text, re.I)
            if match:
                return match.group(1) if "FY" in pattern else match.group()

        return "Unknown"

    def _classify_report(self, title: str) -> str:
        """Classify report type based on title."""
        title_lower = title.lower()

        if "county" in title_lower and "budget" in title_lower:
            return "County Budget Report"
        elif "national" in title_lower and "budget" in title_lower:
            return "National Budget Report"
        elif "implementation" in title_lower:
            return "Budget Implementation Report"
        elif "quarterly" in title_lower:
            return "Quarterly Report"
        elif "annual" in title_lower:
            return "Annual Report"
        elif "expenditure" in title_lower:
            return "Expenditure Report"
        else:
            return "Government Report"

    def _analyze_performance(self) -> Dict:
        """Analyze performance and provide recommendations."""
        if not self.successful_pages:
            return {
                "status": "No successful pages loaded",
                "recommendation": "COB website appears to be down or extremely slow",
            }

        avg_load_time = sum(p["load_time"] for p in self.successful_pages) / len(
            self.successful_pages
        )
        max_load_time = max(p["load_time"] for p in self.successful_pages)
        min_load_time = min(p["load_time"] for p in self.successful_pages)

        analysis = {
            "average_load_time": avg_load_time,
            "max_load_time": max_load_time,
            "min_load_time": min_load_time,
            "success_rate": len(self.successful_pages)
            / (len(self.successful_pages) + len(self.failed_pages))
            * 100,
            "recommendation": "",
        }

        if avg_load_time > 120:
            analysis["recommendation"] = (
                "COB website is extremely slow (>2min avg). Consider running during off-peak hours."
            )
        elif avg_load_time > 60:
            analysis["recommendation"] = (
                "COB website is very slow (>1min avg). Current settings are appropriate."
            )
        else:
            analysis["recommendation"] = (
                "COB website performance is acceptable. Could reduce timeouts."
            )

        return analysis

    def download_priority_reports(
        self, reports: List[Dict], max_downloads: int = 15
    ) -> List[Dict]:
        """Download highest priority reports with patience."""
        logger.info(f"\n📥 Ultra-patient download of up to {max_downloads} reports...")

        # Prioritize recent and important reports
        priority_reports = sorted(
            [r for r in reports if r.get("file_type") in ["pdf", "xlsx", "xls"]],
            key=lambda x: (
                "2024" in x.get("financial_year", ""),
                "2023" in x.get("financial_year", ""),
                "budget" in x.get("title", "").lower(),
                "national" in x.get("title", "").lower(),
            ),
            reverse=True,
        )

        downloaded_reports = []

        for i, report in enumerate(priority_reports[:max_downloads]):
            try:
                logger.info(
                    f"📥 Patient download [{i+1}/{min(len(priority_reports), max_downloads)}]:"
                )
                logger.info(f"   📄 {report['title'][:70]}")

                # Use ultra-patient download
                start_time = time.time()
                response = self.session.get(report["url"], timeout=self.max_timeout)
                end_time = time.time()

                download_time = end_time - start_time

                if response.status_code == 200 and len(response.content) > 1000:
                    # Generate safe filename
                    safe_title = re.sub(r"[^\w\s-]", "", report["title"])
                    safe_title = re.sub(r"\s+", "_", safe_title)[:50]
                    filename = f"{safe_title}.{report['file_type']}"
                    filepath = os.path.join("ultra_patient_reports", filename)

                    # Save file
                    with open(filepath, "wb") as f:
                        f.write(response.content)

                    report["local_file"] = filepath
                    report["file_size"] = len(response.content)
                    report["download_time"] = download_time
                    report["download_status"] = "success"

                    downloaded_reports.append(report)
                    logger.info(
                        f"   ✅ Downloaded in {download_time:.1f}s: {len(response.content):,} bytes"
                    )

                else:
                    logger.warning(
                        f"   ❌ Download failed: Status {response.status_code}"
                    )
                    report["download_status"] = f"failed: HTTP {response.status_code}"

                # Ultra-patient wait between downloads
                if i < min(len(priority_reports), max_downloads) - 1:
                    logger.info(
                        f"   😴 Waiting {self.wait_between_pages}s before next download..."
                    )
                    time.sleep(self.wait_between_pages)

            except Exception as e:
                logger.warning(f"   ❌ Download error: {str(e)}")
                report["download_status"] = f"error: {str(e)}"

        return downloaded_reports

    def run_ultra_patient_extraction(self):
        """Run the complete ultra-patient extraction."""
        logger.info("🕒 Starting ultra-patient COB extraction...")
        logger.info("⚠️ This will take a long time due to extremely slow COB website")

        start_time = datetime.now()

        # Extract reports
        results = self.extract_ultra_patient_reports()

        # Download priority reports
        if results["discovered_reports"]:
            downloaded_reports = self.download_priority_reports(
                results["discovered_reports"]
            )
            results["downloaded_reports"] = downloaded_reports
            results["extraction_summary"]["reports_downloaded"] = len(
                downloaded_reports
            )
        else:
            results["downloaded_reports"] = []
            results["extraction_summary"]["reports_downloaded"] = 0

        end_time = datetime.now()
        total_duration = (end_time - start_time).total_seconds()
        results["extraction_summary"]["total_duration_seconds"] = total_duration

        # Log final summary
        summary = results["extraction_summary"]
        perf = results["performance_analysis"]

        logger.info("\n" + "=" * 80)
        logger.info("🕒 ULTRA-PATIENT EXTRACTION COMPLETE")
        logger.info("=" * 80)
        logger.info(f"📊 Total Reports Found: {summary['total_reports_found']}")
        logger.info(f"✅ Successful Pages: {summary['successful_pages']}")
        logger.info(f"❌ Failed Pages: {summary['failed_pages']}")
        logger.info(f"💾 Reports Downloaded: {summary['reports_downloaded']}")
        logger.info(f"⏱️ Total Duration: {total_duration/60:.1f} minutes")

        if "average_load_time" in perf:
            logger.info(
                f"📈 Average Page Load: {perf['average_load_time']:.1f} seconds"
            )
            logger.info(f"📊 Success Rate: {perf['success_rate']:.1f}%")
            logger.info(f"💡 Recommendation: {perf['recommendation']}")

        return results


def main():
    """Main function for ultra-patient extraction."""
    print("🕒 Ultra-Patient COB Extractor")
    print(
        "⚠️ WARNING: This will take a VERY long time due to extremely slow COB website"
    )
    print("🕒 Each page may take 2-3 minutes to load")
    print("🔄 The extractor will be patient and retry failed requests")
    print()

    extractor = UltraPatientCOBExtractor()
    results = extractor.run_ultra_patient_extraction()

    # Save results
    with open("ultra_patient_cob_reports.json", "w") as f:
        json.dump(results, f, indent=2)

    summary = results["extraction_summary"]

    print(f"\n✅ Ultra-patient extraction completed!")
    print(f"📊 Total Reports: {summary['total_reports_found']}")
    print(f"✅ Successful Pages: {summary['successful_pages']}")
    print(f"💾 Downloaded: {summary['reports_downloaded']}")
    print(f"⏱️ Duration: {summary['total_duration_seconds']/60:.1f} minutes")
    print(f"📁 Results: ultra_patient_cob_reports.json")
    print(f"📂 Files: ./ultra_patient_reports/ directory")


if __name__ == "__main__":
    main()
