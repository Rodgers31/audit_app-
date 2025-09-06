"""
Selenium-based COB Dropdown Extractor
Uses browser automation to interact with dropdown menus and JavaScript content
Designed to find all the reports from the dropdown menus shown in screenshots
"""

import json
import logging
import os
import re
import time
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin

# Note: This requires installing selenium and a webdriver
# pip install selenium
# Download ChromeDriver from https://chromedriver.chromium.org/

try:
    from selenium import webdriver
    from selenium.common.exceptions import NoSuchElementException, TimeoutException
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SeleniumCOBExtractor:
    """Selenium-based extractor for COB dropdown menus."""

    def __init__(self):
        self.base_url = "https://cob.go.ke"
        self.discovered_reports = []
        self.driver = None

        # Fallback session for direct requests
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
        self.session.verify = False

        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        os.makedirs("cob_selenium_reports", exist_ok=True)

    def setup_driver(self):
        """Setup Chrome driver with appropriate options."""
        if not SELENIUM_AVAILABLE:
            logger.warning(
                "⚠️ Selenium not available. Install with: pip install selenium"
            )
            return False

        try:
            chrome_options = Options()
            chrome_options.add_argument("--headless")  # Run headless Chrome
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--allow-running-insecure-content")
            chrome_options.add_argument("--ignore-certificate-errors")

            # Set user agent
            chrome_options.add_argument(
                "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )

            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.set_page_load_timeout(60)

            logger.info("✅ Chrome driver initialized successfully")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to setup Chrome driver: {str(e)}")
            logger.info("💡 Make sure ChromeDriver is installed and in PATH")
            return False

    def extract_with_selenium(self):
        """Extract reports using Selenium to interact with dropdowns."""
        if not self.setup_driver():
            logger.warning("🔄 Falling back to requests-based extraction")
            return self.extract_with_requests_fallback()

        try:
            logger.info("🌐 Loading COB website with Selenium...")
            self.driver.get(f"{self.base_url}/reports/")

            # Wait for page to load
            WebDriverWait(self.driver, 30).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            logger.info("✅ Page loaded successfully")

            # Look for dropdown menus
            dropdown_reports = self._extract_dropdown_menus()

            # Look for direct links on the page
            direct_reports = self._extract_direct_links()

            # Combine results
            all_reports = dropdown_reports + direct_reports

            return all_reports

        except Exception as e:
            logger.error(f"❌ Selenium extraction failed: {str(e)}")
            return []

        finally:
            if self.driver:
                self.driver.quit()

    def _extract_dropdown_menus(self):
        """Extract reports from dropdown menus."""
        reports = []

        try:
            # Look for common dropdown selectors
            dropdown_selectors = [
                "select",
                ".dropdown",
                ".dropdown-menu",
                "#menu",
                ".menu",
                "[role='menu']",
                "[role='listbox']",
                ".nav-dropdown",
            ]

            for selector in dropdown_selectors:
                try:
                    dropdowns = self.driver.find_elements(By.CSS_SELECTOR, selector)

                    for dropdown in dropdowns:
                        # Try to click/hover to open dropdown
                        try:
                            self.driver.execute_script(
                                "arguments[0].click();", dropdown
                            )
                            time.sleep(2)  # Wait for dropdown to open

                            # Look for links in the dropdown
                            links = dropdown.find_elements(By.TAG_NAME, "a")

                            for link in links:
                                href = link.get_attribute("href")
                                text = link.text.strip()

                                if href and any(
                                    ext in href.lower()
                                    for ext in [".pdf", ".xlsx", ".xls", ".doc"]
                                ):
                                    report = {
                                        "title": text or "Dropdown Report",
                                        "url": href,
                                        "file_type": href.split(".")[-1].lower(),
                                        "source": "dropdown_menu",
                                        "discovery_method": "selenium_dropdown",
                                        "discovered_at": datetime.now().isoformat(),
                                    }
                                    reports.append(report)
                                    logger.info(
                                        f"📄 Found dropdown report: {text[:50]}"
                                    )

                        except Exception as e:
                            logger.debug(f"Dropdown interaction failed: {e}")
                            continue

                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")
                    continue

        except Exception as e:
            logger.warning(f"⚠️ Dropdown extraction failed: {e}")

        return reports

    def _extract_direct_links(self):
        """Extract direct document links from the page."""
        reports = []

        try:
            # Find all links on the page
            links = self.driver.find_elements(By.TAG_NAME, "a")

            for link in links:
                try:
                    href = link.get_attribute("href")
                    text = link.text.strip()

                    if href and any(
                        ext in href.lower() for ext in [".pdf", ".xlsx", ".xls", ".doc"]
                    ):
                        report = {
                            "title": text or "Direct Link Report",
                            "url": href,
                            "file_type": href.split(".")[-1].lower(),
                            "source": "direct_link",
                            "discovery_method": "selenium_direct",
                            "discovered_at": datetime.now().isoformat(),
                        }
                        reports.append(report)
                        logger.info(f"📄 Found direct report: {text[:50]}")

                except Exception as e:
                    logger.debug(f"Link processing failed: {e}")
                    continue

        except Exception as e:
            logger.warning(f"⚠️ Direct links extraction failed: {e}")

        return reports

    def extract_with_requests_fallback(self):
        """Fallback extraction using requests when Selenium isn't available."""
        logger.info("🔄 Using requests-based fallback extraction...")

        reports = []

        # Try multiple COB report pages
        report_pages = [
            f"{self.base_url}/reports/",
            f"{self.base_url}/reports/consolidated-county-budget-implementation-review-reports/",
            f"{self.base_url}/reports/national-government-budget-implementation-review-reports/",
            f"{self.base_url}/reports/expenditure-templates/",
            f"{self.base_url}/reports/financial-reports/",
        ]

        for page_url in report_pages:
            try:
                logger.info(f"🔍 Checking page: {page_url}")
                response = self.session.get(page_url, timeout=45)

                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, "html.parser")

                    # Find document links
                    doc_links = soup.find_all(
                        "a", href=re.compile(r"\.(pdf|xlsx?|docx?)$", re.I)
                    )

                    for link in doc_links:
                        href = link.get("href")
                        if not href.startswith("http"):
                            href = urljoin(page_url, href)

                        title = link.get_text(strip=True) or link.get(
                            "title", "Unknown Report"
                        )

                        report = {
                            "title": title,
                            "url": href,
                            "file_type": href.split(".")[-1].lower(),
                            "source_page": page_url,
                            "discovery_method": "requests_fallback",
                            "financial_year": self._extract_financial_year(title),
                            "discovered_at": datetime.now().isoformat(),
                        }

                        reports.append(report)
                        logger.info(f"📄 Found report: {title[:50]}")

                time.sleep(2)  # Be respectful

            except Exception as e:
                logger.warning(f"⚠️ Failed to process {page_url}: {e}")

        return reports

    def discover_wordpress_uploads(self):
        """Discover reports in WordPress uploads directory."""
        logger.info("🔍 Discovering WordPress uploads...")

        reports = []
        years = ["2024", "2023", "2022", "2021", "2020"]
        months = [
            "01",
            "02",
            "03",
            "04",
            "05",
            "06",
            "07",
            "08",
            "09",
            "10",
            "11",
            "12",
        ]

        for year in years:
            # Try year-level directory
            year_url = f"{self.base_url}/wp-content/uploads/{year}/"

            try:
                response = self.session.get(year_url, timeout=20)
                if response.status_code == 200:
                    logger.info(f"✅ Found uploads directory: {year}")
                    soup = BeautifulSoup(response.content, "html.parser")

                    # Look for document links
                    links = soup.find_all("a", href=True)
                    for link in links:
                        href = link.get("href")
                        if any(
                            ext in href.lower() for ext in [".pdf", ".xlsx", ".xls"]
                        ):
                            full_url = urljoin(year_url, href)

                            report = {
                                "title": link.get_text(strip=True)
                                or href.split("/")[-1],
                                "url": full_url,
                                "file_type": href.split(".")[-1].lower(),
                                "source": "wordpress_uploads",
                                "year": year,
                                "discovery_method": "uploads_discovery",
                                "discovered_at": datetime.now().isoformat(),
                            }

                            reports.append(report)

                    # Also try month-level directories
                    for month in months[:6]:  # Check first 6 months to avoid timeout
                        month_url = f"{year_url}{month}/"
                        try:
                            month_response = self.session.get(month_url, timeout=15)
                            if month_response.status_code == 200:
                                month_soup = BeautifulSoup(
                                    month_response.content, "html.parser"
                                )
                                month_links = month_soup.find_all(
                                    "a", href=re.compile(r"\.(pdf|xlsx?)$", re.I)
                                )

                                for link in month_links:
                                    href = link.get("href")
                                    full_url = urljoin(month_url, href)

                                    report = {
                                        "title": link.get_text(strip=True)
                                        or href.split("/")[-1],
                                        "url": full_url,
                                        "file_type": href.split(".")[-1].lower(),
                                        "source": "wordpress_uploads_monthly",
                                        "year": year,
                                        "month": month,
                                        "discovery_method": "monthly_uploads_discovery",
                                        "discovered_at": datetime.now().isoformat(),
                                    }

                                    reports.append(report)

                        except Exception as e:
                            logger.debug(f"Month {month} failed: {e}")
                            continue

                time.sleep(1)

            except Exception as e:
                logger.debug(f"Year {year} uploads failed: {e}")
                continue

        return reports

    def _extract_financial_year(self, text: str) -> str:
        """Extract financial year from text."""
        patterns = [r"FY\s*(20\d{2}[/-]\d{2,4})", r"20\d{2}[/-]\d{2,4}", r"20\d{2}"]

        for pattern in patterns:
            match = re.search(pattern, text, re.I)
            if match:
                return match.group(1) if "FY" in pattern else match.group()

        return "Unknown"

    def download_reports(
        self, reports: List[Dict], max_downloads: int = 25
    ) -> List[Dict]:
        """Download discovered reports."""
        logger.info(f"📥 Downloading up to {max_downloads} reports...")

        downloaded_reports = []

        # Prioritize recent reports
        sorted_reports = sorted(
            reports,
            key=lambda x: (
                "2024" in x.get("financial_year", ""),
                "2023" in x.get("financial_year", ""),
                x.get("file_type") == "pdf",
            ),
            reverse=True,
        )

        for i, report in enumerate(sorted_reports[:max_downloads]):
            try:
                logger.info(
                    f"📥 Downloading [{i+1}/{min(len(sorted_reports), max_downloads)}]: {report['title'][:60]}..."
                )

                response = self.session.get(report["url"], timeout=90)

                if response.status_code == 200 and len(response.content) > 1000:
                    # Generate safe filename
                    safe_title = re.sub(r"[^\w\s-]", "", report["title"])
                    safe_title = re.sub(r"\s+", "_", safe_title)[:50]
                    filename = f"{safe_title}.{report['file_type']}"
                    filepath = os.path.join("cob_selenium_reports", filename)

                    # Save file
                    with open(filepath, "wb") as f:
                        f.write(response.content)

                    report["local_file"] = filepath
                    report["file_size"] = len(response.content)
                    report["download_status"] = "success"

                    downloaded_reports.append(report)
                    logger.info(
                        f"✅ Downloaded: {filename} ({len(response.content):,} bytes)"
                    )

                else:
                    logger.warning(
                        f"❌ Download failed: {report['title'][:30]} - Status: {response.status_code}"
                    )
                    report["download_status"] = f"failed: HTTP {response.status_code}"

                time.sleep(2)  # Be respectful

            except Exception as e:
                logger.warning(
                    f"❌ Download error for {report['title'][:30]}: {str(e)}"
                )
                report["download_status"] = f"error: {str(e)}"

        return downloaded_reports

    def run_comprehensive_extraction(self):
        """Run comprehensive extraction using all available methods."""
        logger.info("\n" + "=" * 80)
        logger.info("🎯 SELENIUM-BASED COB REPORTS EXTRACTION")
        logger.info("📋 Interactive dropdown menu navigation")
        logger.info("=" * 80)

        start_time = datetime.now()

        # Method 1: Selenium-based extraction (if available)
        selenium_reports = self.extract_with_selenium()

        # Method 2: WordPress uploads discovery
        uploads_reports = self.discover_wordpress_uploads()

        # Combine and deduplicate
        all_reports = selenium_reports + uploads_reports

        # Remove duplicates based on URL
        seen_urls = set()
        unique_reports = []
        for report in all_reports:
            if report["url"] not in seen_urls:
                seen_urls.add(report["url"])
                unique_reports.append(report)

        # Download sample reports
        downloaded_reports = self.download_reports(unique_reports)

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        results = {
            "extraction_summary": {
                "total_reports_discovered": len(unique_reports),
                "selenium_reports": len(selenium_reports),
                "uploads_reports": len(uploads_reports),
                "unique_reports": len(unique_reports),
                "reports_downloaded": len(downloaded_reports),
                "extraction_duration_seconds": duration,
                "selenium_available": SELENIUM_AVAILABLE,
                "timestamp": datetime.now().isoformat(),
            },
            "discovered_reports": unique_reports,
            "downloaded_reports": downloaded_reports,
            "extraction_methods": {
                "selenium_dropdown": len(
                    [
                        r
                        for r in selenium_reports
                        if r.get("discovery_method") == "selenium_dropdown"
                    ]
                ),
                "selenium_direct": len(
                    [
                        r
                        for r in selenium_reports
                        if r.get("discovery_method") == "selenium_direct"
                    ]
                ),
                "uploads_discovery": len(
                    [
                        r
                        for r in uploads_reports
                        if r.get("discovery_method") == "uploads_discovery"
                    ]
                ),
                "monthly_uploads": len(
                    [
                        r
                        for r in uploads_reports
                        if r.get("discovery_method") == "monthly_uploads_discovery"
                    ]
                ),
            },
        }

        # Log summary
        summary = results["extraction_summary"]
        logger.info(f"\n🎯 SELENIUM EXTRACTION COMPLETE:")
        logger.info(
            f"   📊 Total Reports Discovered: {summary['total_reports_discovered']}"
        )
        logger.info(f"   🖥️ Selenium Reports: {summary['selenium_reports']}")
        logger.info(f"   📁 Uploads Reports: {summary['uploads_reports']}")
        logger.info(f"   🔄 Unique Reports: {summary['unique_reports']}")
        logger.info(f"   💾 Downloaded: {summary['reports_downloaded']}")
        logger.info(f"   🛠️ Selenium Available: {summary['selenium_available']}")
        logger.info(f"   ⏱️ Duration: {duration:.1f} seconds")

        return results


def main():
    """Main function to run selenium-based extraction."""
    if not SELENIUM_AVAILABLE:
        print("⚠️ Selenium not available. Install with:")
        print("   pip install selenium")
        print("   Download ChromeDriver from: https://chromedriver.chromium.org/")
        print("🔄 Proceeding with requests-based fallback...")

    extractor = SeleniumCOBExtractor()
    results = extractor.run_comprehensive_extraction()

    # Save results
    with open("selenium_cob_reports.json", "w") as f:
        json.dump(results, f, indent=2)

    summary = results["extraction_summary"]

    print(f"\n✅ Selenium-based COB extraction completed!")
    print(f"📊 Total Reports: {summary['total_reports_discovered']}")
    print(
        f"🖥️ Selenium: {summary['selenium_reports']} | 📁 Uploads: {summary['uploads_reports']}"
    )
    print(f"💾 Downloaded: {summary['reports_downloaded']}")
    print(f"⏱️ Duration: {summary['extraction_duration_seconds']:.1f} seconds")
    print(f"📁 Results: selenium_cob_reports.json")
    print(f"📂 Files: ./cob_selenium_reports/ directory")


if __name__ == "__main__":
    main()
