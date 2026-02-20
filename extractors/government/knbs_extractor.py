"""
Kenya National Bureau of Statistics (KNBS) Data Extractor
Specialized extractor for KNBS publications: Economic Survey, Statistical Abstract,
county statistical reports, and other economic/demographic data
"""

import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KNBSExtractor:
    """Specialized extractor for Kenya National Bureau of Statistics data."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        # Prefer a pinned CA bundle for KNBS to avoid intermittent certificate trust issues
        cert_path = (
            Path(__file__).resolve().parents[2]
            / "config"
            / "certs"
            / "knbs_trust_store.pem"
        )
        if cert_path.exists():
            self.session.verify = str(cert_path)
            logger.info("[CERT] Using pinned KNBS certificate bundle: %s", cert_path)
        else:
            # Fall back to default trust store but warn so operators can provision the bundle
            self.session.verify = True
            logger.warning(
                "[WARN] KNBS certificate bundle missing at %s; using default trust store",
                cert_path,
            )

        self.base_url = "https://www.knbs.or.ke"
        self.publications = []
        self.statistical_releases = []

        # Priority data types
        self.priority_publications = [
            "Economic Survey",  # Annual, published in May
            "Statistical Abstract",  # Annual, published in December
            "Facts and Figures",  # Annual summary
            "County Statistical Abstract",  # County-level data
            "GDP",  # Quarterly GDP reports
            "CPI",  # Monthly Consumer Price Index
            "Population",  # Population data and projections
            "Poverty",  # Poverty indices
        ]

        # Kenya's 47 counties for matching
        self.counties = [
            "Nairobi",
            "Mombasa",
            "Kwale",
            "Kilifi",
            "Tana River",
            "Lamu",
            "Taita Taveta",
            "Garissa",
            "Wajir",
            "Mandera",
            "Marsabit",
            "Isiolo",
            "Meru",
            "Tharaka Nithi",
            "Embu",
            "Kitui",
            "Machakos",
            "Makueni",
            "Nyandarua",
            "Nyeri",
            "Kirinyaga",
            "Murang'a",
            "Kiambu",
            "Turkana",
            "West Pokot",
            "Samburu",
            "Trans Nzoia",
            "Uasin Gishu",
            "Elgeyo Marakwet",
            "Nandi",
            "Baringo",
            "Laikipia",
            "Nakuru",
            "Narok",
            "Kajiado",
            "Kericho",
            "Bomet",
            "Kakamega",
            "Vihiga",
            "Bungoma",
            "Busia",
            "Siaya",
            "Kisumu",
            "Homa Bay",
            "Migori",
            "Kisii",
            "Nyamira",
        ]

    def discover_documents(self) -> List[Dict]:
        """
        Main entry point for discovering KNBS documents.
        Returns list of document metadata for ETL pipeline.
        """
        logger.info("🔍 Starting KNBS document discovery...")

        all_documents = []

        # 1. Extract major publications (Economic Survey, Statistical Abstract)
        publications = self.extract_major_publications()
        all_documents.extend(publications)

        # 2. Extract statistical releases (GDP, CPI, etc.)
        releases = self.extract_statistical_releases()
        all_documents.extend(releases)

        # 3. Extract county statistical abstracts
        county_data = self.extract_county_statistical_abstracts()
        all_documents.extend(county_data)

        logger.info(f"✅ KNBS discovery complete: {len(all_documents)} documents found")
        return all_documents

    def extract_major_publications(self) -> List[Dict]:
        """Extract major KNBS publications like Economic Survey, Statistical Abstract."""
        logger.info("📊 Extracting major KNBS publications...")

        publications = []

        # URLs to check for major publications
        urls = [
            f"{self.base_url}/publications/",
            f"{self.base_url}/new/",  # Latest releases
            f"{self.base_url}/popular/",  # Popular publications
            f"{self.base_url}/economic-surveys/",
        ]

        for url in urls:
            try:
                logger.info(f"🔍 Checking: {url}")
                response = self.session.get(url, timeout=30)

                if response.status_code != 200:
                    logger.warning(f"⚠️ Failed to fetch {url}: {response.status_code}")
                    continue

                soup = BeautifulSoup(response.content, "html.parser")

                # Find links to publications (usually PDF links or report pages)
                links = soup.find_all("a", href=True)

                for link in links:
                    href = link.get("href", "")
                    text = link.get_text(strip=True)

                    # Check if this is a priority publication
                    if not self._is_priority_publication(text):
                        continue

                    # Extract full URL
                    if href.startswith("http"):
                        full_url = href
                    elif href.startswith("/"):
                        full_url = f"{self.base_url}{href}"
                    else:
                        full_url = f"{self.base_url}/{href}"

                    # Check if it's a PDF or report page
                    if ".pdf" in href.lower():
                        pdf_url = full_url
                        report_page = url
                    else:
                        # It's a report page, need to visit to find PDF
                        pdf_url = self._find_pdf_on_page(full_url)
                        report_page = full_url

                    if not pdf_url:
                        continue

                    # Extract metadata
                    publication_data = {
                        "title": text,
                        "url": pdf_url,
                        "report_page": report_page,
                        "type": self._categorize_publication(text),
                        "year": self._extract_year(text),
                        "county": self._extract_county_name(text),
                        "source": "KNBS",
                        "source_type": "publication",
                        "extracted_date": datetime.now().isoformat(),
                        "priority": self._get_priority_level(text),
                    }

                    # Avoid duplicates
                    if not any(p["url"] == pdf_url for p in publications):
                        publications.append(publication_data)
                        logger.info(f"✅ Found: {text[:60]}...")

                time.sleep(1)  # Be polite to the server

            except Exception as e:
                logger.error(f"❌ Error extracting from {url}: {str(e)}")

        logger.info(f"📊 Found {len(publications)} major publications")
        return publications

    def extract_statistical_releases(self) -> List[Dict]:
        """Extract statistical releases (monthly/quarterly indicators)."""
        logger.info("📈 Extracting statistical releases...")

        releases = []

        # URLs for statistical releases
        release_urls = [
            f"{self.base_url}/statistical-releases/",
            f"{self.base_url}/statistical-releases/leading-economic-indicators/",
            f"{self.base_url}/statistical-releases/cpi-and-inflation-rates/",
            f"{self.base_url}/statistical-releases/quarterly-gdp/",
            f"{self.base_url}/statistical-releases/gross-county-product/",
        ]

        for url in release_urls:
            try:
                logger.info(f"🔍 Checking: {url}")
                response = self.session.get(url, timeout=30)

                if response.status_code != 200:
                    logger.warning(f"⚠️ Failed to fetch {url}: {response.status_code}")
                    continue

                soup = BeautifulSoup(response.content, "html.parser")

                # Find report links
                links = soup.find_all("a", href=True)

                for link in links:
                    href = link.get("href", "")
                    text = link.get_text(strip=True)

                    # Look for PDF links or report pages
                    if ".pdf" in href.lower():
                        if href.startswith("http"):
                            pdf_url = href
                        else:
                            pdf_url = (
                                f"{self.base_url}{href}"
                                if href.startswith("/")
                                else f"{self.base_url}/{href}"
                            )

                        release_data = {
                            "title": text or self._extract_title_from_url(pdf_url),
                            "url": pdf_url,
                            "report_page": url,
                            "type": "statistical_release",
                            "release_type": self._categorize_release(text or pdf_url),
                            "period": self._extract_period(text or pdf_url),
                            "year": self._extract_year(text or pdf_url),
                            "quarter": self._extract_quarter(text or pdf_url),
                            "source": "KNBS",
                            "source_type": "statistical_release",
                            "extracted_date": datetime.now().isoformat(),
                        }

                        # Avoid duplicates
                        if not any(r["url"] == pdf_url for r in releases):
                            releases.append(release_data)
                            logger.info(
                                f"✅ Found: {text[:60] if text else pdf_url[:60]}..."
                            )

                time.sleep(1)

            except Exception as e:
                logger.error(f"❌ Error extracting from {url}: {str(e)}")

        logger.info(f"📈 Found {len(releases)} statistical releases")
        return releases

    def extract_county_statistical_abstracts(self) -> List[Dict]:
        """Extract county-level statistical abstracts."""
        logger.info("🗺️ Extracting county statistical abstracts...")

        county_abstracts = []

        # URL for county statistical abstracts
        url = f"{self.base_url}/county-statistical-abstracts/"

        try:
            logger.info(f"🔍 Checking: {url}")
            response = self.session.get(url, timeout=30)

            if response.status_code != 200:
                logger.warning(f"⚠️ Failed to fetch {url}: {response.status_code}")
                return county_abstracts

            soup = BeautifulSoup(response.content, "html.parser")

            # Find county abstract links
            links = soup.find_all("a", href=True)

            for link in links:
                href = link.get("href", "")
                text = link.get_text(strip=True)

                # Check if it's a county abstract
                county = self._extract_county_name(text)
                if not county:
                    continue

                # Extract PDF URL
                if ".pdf" in href.lower():
                    if href.startswith("http"):
                        pdf_url = href
                    else:
                        pdf_url = (
                            f"{self.base_url}{href}"
                            if href.startswith("/")
                            else f"{self.base_url}/{href}"
                        )
                else:
                    # Visit page to find PDF
                    page_url = (
                        href if href.startswith("http") else f"{self.base_url}{href}"
                    )
                    pdf_url = self._find_pdf_on_page(page_url)

                if not pdf_url:
                    continue

                abstract_data = {
                    "title": text,
                    "url": pdf_url,
                    "report_page": url,
                    "type": "county_statistical_abstract",
                    "county": county,
                    "year": self._extract_year(text),
                    "source": "KNBS",
                    "source_type": "county_abstract",
                    "extracted_date": datetime.now().isoformat(),
                }

                # Avoid duplicates
                if not any(c["url"] == pdf_url for c in county_abstracts):
                    county_abstracts.append(abstract_data)
                    logger.info(f"✅ Found: {county} - {text[:50]}...")

        except Exception as e:
            logger.error(f"❌ Error extracting county abstracts: {str(e)}")

        logger.info(f"🗺️ Found {len(county_abstracts)} county statistical abstracts")
        return county_abstracts

    def _find_pdf_on_page(self, page_url: str) -> Optional[str]:
        """Visit a report page and find the PDF download link."""
        try:
            response = self.session.get(page_url, timeout=15)
            if response.status_code != 200:
                return None

            soup = BeautifulSoup(response.content, "html.parser")

            # Look for PDF links
            pdf_links = soup.find_all("a", href=re.compile(r"\.pdf$", re.I))

            if pdf_links:
                href = pdf_links[0].get("href", "")
                if href.startswith("http"):
                    return href
                elif href.startswith("/"):
                    return f"{self.base_url}{href}"
                else:
                    return f"{self.base_url}/{href}"

            return None
        except:
            return None

    def _is_priority_publication(self, text: str) -> bool:
        """Check if text matches a priority publication."""
        text_lower = text.lower()
        return any(
            keyword.lower() in text_lower for keyword in self.priority_publications
        )

    def _categorize_publication(self, text: str) -> str:
        """Categorize the publication type."""
        text_lower = text.lower()

        if "economic survey" in text_lower:
            return "economic_survey"
        elif "statistical abstract" in text_lower:
            return "statistical_abstract"
        elif "facts and figures" in text_lower or "facts & figures" in text_lower:
            return "facts_and_figures"
        elif "county" in text_lower:
            return "county_abstract"
        elif "population" in text_lower or "census" in text_lower:
            return "population_report"
        elif "poverty" in text_lower:
            return "poverty_report"
        elif "gdp" in text_lower or "gross domestic product" in text_lower:
            return "gdp_report"
        else:
            return "general_publication"

    def _categorize_release(self, text: str) -> str:
        """Categorize the statistical release type."""
        text_lower = text.lower()

        if "leading economic" in text_lower or "lei" in text_lower:
            return "leading_economic_indicators"
        elif (
            "cpi" in text_lower
            or "consumer price" in text_lower
            or "inflation" in text_lower
        ):
            return "cpi_inflation"
        elif "ppi" in text_lower or "producer price" in text_lower:
            return "ppi"
        elif "gdp" in text_lower or "gross domestic" in text_lower:
            return "quarterly_gdp"
        elif "bop" in text_lower or "balance of payments" in text_lower:
            return "balance_of_payments"
        elif "gross county product" in text_lower or "gcp" in text_lower:
            return "gross_county_product"
        else:
            return "general_release"

    def _extract_year(self, text: str) -> Optional[int]:
        """Extract year from text (YYYY format)."""
        match = re.search(r"20\d{2}", text)
        return int(match.group(0)) if match else None

    def _extract_quarter(self, text: str) -> Optional[str]:
        """Extract quarter from text."""
        text_lower = text.lower()
        if "q1" in text_lower or "first quarter" in text_lower:
            return "Q1"
        elif "q2" in text_lower or "second quarter" in text_lower:
            return "Q2"
        elif "q3" in text_lower or "third quarter" in text_lower:
            return "Q3"
        elif "q4" in text_lower or "fourth quarter" in text_lower:
            return "Q4"
        return None

    def _extract_period(self, text: str) -> Optional[str]:
        """Extract period (month, quarter) from text."""
        months = [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
        ]

        text_lower = text.lower()
        for month in months:
            if month in text_lower:
                return month.capitalize()

        quarter = self._extract_quarter(text)
        if quarter:
            return quarter

        return None

    def _extract_county_name(self, text: str) -> Optional[str]:
        """Extract county name from text."""
        text_lower = text.lower()
        for county in self.counties:
            if county.lower() in text_lower:
                return county
        return None

    def _extract_title_from_url(self, url: str) -> str:
        """Extract title from PDF URL filename."""
        # Get filename from URL
        filename = (
            url.split("/")[-1].replace(".pdf", "").replace("-", " ").replace("_", " ")
        )
        # Capitalize first letter of each word
        return " ".join(word.capitalize() for word in filename.split())

    def _get_priority_level(self, text: str) -> str:
        """Determine priority level for processing."""
        text_lower = text.lower()

        # High priority: Economic Survey, Statistical Abstract, GDP, Population
        if any(
            keyword in text_lower
            for keyword in [
                "economic survey",
                "statistical abstract",
                "gdp",
                "population",
                "poverty",
            ]
        ):
            return "high"

        # Medium priority: Facts & Figures, County abstracts
        elif any(keyword in text_lower for keyword in ["facts", "county"]):
            return "medium"

        # Low priority: Everything else
        else:
            return "low"

    def save_to_json(self, filename: str = "knbs_documents.json"):
        """Save extracted documents to JSON file."""
        all_documents = self.publications + self.statistical_releases

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(all_documents, f, indent=2, ensure_ascii=False)

        logger.info(f"💾 Saved {len(all_documents)} documents to {filename}")


# Example usage
if __name__ == "__main__":
    extractor = KNBSExtractor()

    # Discover all documents
    documents = extractor.discover_documents()

    # Print summary
    print(f"\n{'='*60}")
    print(f"KNBS Document Discovery Summary")
    print(f"{'='*60}")
    print(f"Total documents found: {len(documents)}")

    # Group by type
    by_type = {}
    for doc in documents:
        doc_type = doc.get("type", "unknown")
        by_type[doc_type] = by_type.get(doc_type, 0) + 1

    print(f"\nBy document type:")
    for doc_type, count in sorted(by_type.items()):
        print(f"  {doc_type}: {count}")

    # Save to JSON
    extractor.save_to_json()

    print(f"\n✅ KNBS extraction complete!")
