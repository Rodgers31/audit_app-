"""
Kenya Open Data Portal Extractor

Discovers and downloads datasets from Kenya's Open Data Portal (opendata.go.ke)
using the CKAN API.

CKAN (Comprehensive Knowledge Archive Network) is the standard platform for
government open data portals worldwide.

Usage:
    from extractors.government.opendata_extractor import OpenDataExtractor

    extractor = OpenDataExtractor()
    datasets = extractor.discover_revenue_data()
"""

import logging
import re
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class OpenDataExtractor:
    """
    Extractor for Kenya Open Data Portal using CKAN API

    The CKAN API provides programmatic access to datasets, resources,
    and metadata from opendata.go.ke.
    """

    def __init__(self, base_url: str = "https://opendata.go.ke"):
        """
        Initialize the Open Data extractor

        Args:
            base_url: Base URL of the Open Data Portal
        """
        self.base_url = base_url
        self.api_url = f"{base_url}/api/3/action"
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )

        logger.info(f"OpenDataExtractor initialized for {base_url}")

    def search_datasets(
        self,
        query: str = "",
        tags: Optional[List[str]] = None,
        organization: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """
        Search for datasets using CKAN API

        Args:
            query: Search query string
            tags: Filter by tags (e.g., ['revenue', 'budget'])
            organization: Filter by organization name
            limit: Maximum number of results

        Returns:
            List of dataset metadata dictionaries
        """
        logger.info(
            f"🔍 Searching datasets: query='{query}', tags={tags}, org={organization}"
        )

        try:
            # Build search parameters
            params = {"q": query, "rows": limit}

            # Add filter queries
            fq_parts = []
            if tags:
                tag_query = " OR ".join([f"tags:{tag}" for tag in tags])
                fq_parts.append(f"({tag_query})")

            if organization:
                fq_parts.append(f"organization:{organization}")

            if fq_parts:
                params["fq"] = " AND ".join(fq_parts)

            # Make API request
            response = self.session.get(
                f"{self.api_url}/package_search", params=params, timeout=30
            )
            response.raise_for_status()

            data = response.json()

            if not data.get("success"):
                logger.error(f"API returned success=False: {data.get('error')}")
                return []

            results = data.get("result", {}).get("results", [])
            logger.info(f"✅ Found {len(results)} datasets")

            return results

        except requests.RequestException as e:
            logger.error(f"❌ API request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error in search_datasets: {e}")
            return []

    def get_dataset_details(self, dataset_id: str) -> Optional[Dict]:
        """
        Get detailed metadata for a specific dataset

        Args:
            dataset_id: Dataset identifier (name or ID)

        Returns:
            Dataset metadata dictionary or None
        """
        logger.info(f"📊 Fetching dataset details: {dataset_id}")

        try:
            response = self.session.get(
                f"{self.api_url}/package_show", params={"id": dataset_id}, timeout=30
            )
            response.raise_for_status()

            data = response.json()

            if data.get("success"):
                return data.get("result")
            else:
                logger.error(
                    f"Failed to fetch dataset {dataset_id}: {data.get('error')}"
                )
                return None

        except requests.RequestException as e:
            logger.error(f"❌ Failed to fetch dataset {dataset_id}: {e}")
            return None

    def discover_revenue_data(self) -> List[Dict]:
        """
        Discover revenue-related datasets

        Searches for datasets containing:
        - County revenue data
        - National revenue collections
        - Tax collections
        - Revenue forecasts

        Returns:
            List of dataset metadata with revenue data
        """
        logger.info("💰 Discovering revenue datasets...")

        # Search with multiple revenue-related terms
        revenue_keywords = [
            "revenue",
            "tax",
            "collection",
            "county revenue",
            "local revenue",
            "own source revenue",
        ]

        all_datasets = []

        for keyword in revenue_keywords:
            datasets = self.search_datasets(
                query=keyword, tags=["revenue", "finance", "county"], limit=50
            )
            all_datasets.extend(datasets)

        # Deduplicate by dataset ID
        unique_datasets = {ds["id"]: ds for ds in all_datasets}
        datasets = list(unique_datasets.values())

        # Filter and enrich
        revenue_datasets = []
        for dataset in datasets:
            # Extract relevant resources (CSV, Excel, JSON)
            resources = self._filter_downloadable_resources(
                dataset.get("resources", [])
            )

            if not resources:
                continue

            for resource in resources:
                revenue_datasets.append(
                    {
                        "dataset_id": dataset["id"],
                        "dataset_name": dataset["name"],
                        "title": dataset["title"],
                        "description": dataset.get("notes", ""),
                        "organization": dataset.get("organization", {}).get(
                            "name", "unknown"
                        ),
                        "resource_id": resource["id"],
                        "resource_name": resource["name"],
                        "url": resource["url"],
                        "format": resource["format"].upper(),
                        "size": resource.get("size", 0),
                        "last_modified": resource.get("last_modified")
                        or dataset.get("metadata_modified"),
                        "type": "revenue",
                        "tags": [tag["name"] for tag in dataset.get("tags", [])],
                    }
                )

        logger.info(f"✅ Discovered {len(revenue_datasets)} revenue resources")
        return revenue_datasets

    def discover_budget_data(self) -> List[Dict]:
        """
        Discover budget-related datasets

        Searches for:
        - County budget allocations
        - National budget documents
        - Budget execution reports
        - Supplementary budgets

        Returns:
            List of dataset metadata with budget data
        """
        logger.info("📊 Discovering budget datasets...")

        budget_keywords = [
            "budget",
            "county budget",
            "budget allocation",
            "budget execution",
            "supplementary budget",
            "appropriation",
        ]

        all_datasets = []

        for keyword in budget_keywords:
            datasets = self.search_datasets(
                query=keyword, tags=["budget", "finance", "county"], limit=50
            )
            all_datasets.extend(datasets)

        # Deduplicate and process
        unique_datasets = {ds["id"]: ds for ds in all_datasets}
        datasets = list(unique_datasets.values())

        budget_datasets = []
        for dataset in datasets:
            resources = self._filter_downloadable_resources(
                dataset.get("resources", [])
            )

            if not resources:
                continue

            for resource in resources:
                budget_datasets.append(
                    {
                        "dataset_id": dataset["id"],
                        "dataset_name": dataset["name"],
                        "title": dataset["title"],
                        "description": dataset.get("notes", ""),
                        "organization": dataset.get("organization", {}).get(
                            "name", "unknown"
                        ),
                        "resource_id": resource["id"],
                        "resource_name": resource["name"],
                        "url": resource["url"],
                        "format": resource["format"].upper(),
                        "size": resource.get("size", 0),
                        "last_modified": resource.get("last_modified")
                        or dataset.get("metadata_modified"),
                        "type": "budget",
                        "tags": [tag["name"] for tag in dataset.get("tags", [])],
                    }
                )

        logger.info(f"✅ Discovered {len(budget_datasets)} budget resources")
        return budget_datasets

    def discover_project_data(self) -> List[Dict]:
        """
        Discover development project datasets

        Searches for:
        - Infrastructure projects
        - Development projects
        - County projects
        - Project implementation status

        Returns:
            List of dataset metadata with project data
        """
        logger.info("🏗️ Discovering project datasets...")

        project_keywords = [
            "project",
            "development project",
            "infrastructure",
            "county project",
            "capital expenditure",
            "implementation",
        ]

        all_datasets = []

        for keyword in project_keywords:
            datasets = self.search_datasets(
                query=keyword,
                tags=["projects", "development", "infrastructure"],
                limit=50,
            )
            all_datasets.extend(datasets)

        unique_datasets = {ds["id"]: ds for ds in all_datasets}
        datasets = list(unique_datasets.values())

        project_datasets = []
        for dataset in datasets:
            resources = self._filter_downloadable_resources(
                dataset.get("resources", [])
            )

            if not resources:
                continue

            for resource in resources:
                project_datasets.append(
                    {
                        "dataset_id": dataset["id"],
                        "dataset_name": dataset["name"],
                        "title": dataset["title"],
                        "description": dataset.get("notes", ""),
                        "organization": dataset.get("organization", {}).get(
                            "name", "unknown"
                        ),
                        "resource_id": resource["id"],
                        "resource_name": resource["name"],
                        "url": resource["url"],
                        "format": resource["format"].upper(),
                        "size": resource.get("size", 0),
                        "last_modified": resource.get("last_modified")
                        or dataset.get("metadata_modified"),
                        "type": "project",
                        "tags": [tag["name"] for tag in dataset.get("tags", [])],
                    }
                )

        logger.info(f"✅ Discovered {len(project_datasets)} project resources")
        return project_datasets

    def discover_procurement_data(self) -> List[Dict]:
        """
        Discover procurement and tender datasets

        Searches for:
        - Tender awards
        - Procurement contracts
        - Supplier information
        - Contract awards

        Returns:
            List of dataset metadata with procurement data
        """
        logger.info("📝 Discovering procurement datasets...")

        procurement_keywords = [
            "procurement",
            "tender",
            "contract",
            "award",
            "supplier",
            "bidding",
        ]

        all_datasets = []

        for keyword in procurement_keywords:
            datasets = self.search_datasets(
                query=keyword, tags=["procurement", "tenders", "contracts"], limit=50
            )
            all_datasets.extend(datasets)

        unique_datasets = {ds["id"]: ds for ds in all_datasets}
        datasets = list(unique_datasets.values())

        procurement_datasets = []
        for dataset in datasets:
            resources = self._filter_downloadable_resources(
                dataset.get("resources", [])
            )

            if not resources:
                continue

            for resource in resources:
                procurement_datasets.append(
                    {
                        "dataset_id": dataset["id"],
                        "dataset_name": dataset["name"],
                        "title": dataset["title"],
                        "description": dataset.get("notes", ""),
                        "organization": dataset.get("organization", {}).get(
                            "name", "unknown"
                        ),
                        "resource_id": resource["id"],
                        "resource_name": resource["name"],
                        "url": resource["url"],
                        "format": resource["format"].upper(),
                        "size": resource.get("size", 0),
                        "last_modified": resource.get("last_modified")
                        or dataset.get("metadata_modified"),
                        "type": "procurement",
                        "tags": [tag["name"] for tag in dataset.get("tags", [])],
                    }
                )

        logger.info(f"✅ Discovered {len(procurement_datasets)} procurement resources")
        return procurement_datasets

    def discover_all_datasets(self) -> List[Dict]:
        """
        Discover all relevant datasets from Open Data Portal

        Combines revenue, budget, project, and procurement datasets

        Returns:
            Complete list of all discoverable datasets
        """
        logger.info("🔍 Discovering all Open Data Portal datasets...")

        all_datasets = []

        # Discover each category
        all_datasets.extend(self.discover_revenue_data())
        all_datasets.extend(self.discover_budget_data())
        all_datasets.extend(self.discover_project_data())
        all_datasets.extend(self.discover_procurement_data())

        logger.info(f"✅ Total datasets discovered: {len(all_datasets)}")

        return all_datasets

    def _filter_downloadable_resources(self, resources: List[Dict]) -> List[Dict]:
        """
        Filter resources to only include downloadable data files

        Args:
            resources: List of resource dictionaries from CKAN

        Returns:
            Filtered list of downloadable resources (CSV, Excel, JSON)
        """
        downloadable_formats = ["CSV", "XLS", "XLSX", "JSON", "XML"]

        filtered = []
        for resource in resources:
            format_str = resource.get("format", "").upper()

            if format_str in downloadable_formats:
                # Check if URL is valid
                url = resource.get("url", "")
                if url and url.startswith("http"):
                    filtered.append(resource)

        return filtered

    def download_resource(self, resource_url: str, output_path: str) -> bool:
        """
        Download a dataset resource to local file

        Args:
            resource_url: URL of the resource to download
            output_path: Local file path to save to

        Returns:
            True if download successful, False otherwise
        """
        logger.info(f"⬇️ Downloading: {resource_url}")

        try:
            response = self.session.get(resource_url, timeout=60, stream=True)
            response.raise_for_status()

            with open(output_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            logger.info(f"✅ Downloaded to: {output_path}")
            return True

        except requests.RequestException as e:
            logger.error(f"❌ Download failed: {e}")
            return False
        except IOError as e:
            logger.error(f"❌ File write failed: {e}")
            return False


if __name__ == "__main__":
    # Test the extractor
    logging.basicConfig(level=logging.INFO)

    print("=" * 80)
    print("Kenya Open Data Portal Extractor - Test Run")
    print("=" * 80)

    extractor = OpenDataExtractor()

    print("\n[Test 1] Searching for revenue datasets...")
    revenue_datasets = extractor.discover_revenue_data()
    print(f"Found {len(revenue_datasets)} revenue resources")

    if revenue_datasets:
        print("\nSample revenue dataset:")
        sample = revenue_datasets[0]
        print(f"  Title: {sample['title']}")
        print(f"  Type: {sample['type']}")
        print(f"  Format: {sample['format']}")
        print(f"  URL: {sample['url'][:80]}...")

    print("\n[Test 2] Searching for budget datasets...")
    budget_datasets = extractor.discover_budget_data()
    print(f"Found {len(budget_datasets)} budget resources")

    print("\n[Test 3] Searching for project datasets...")
    project_datasets = extractor.discover_project_data()
    print(f"Found {len(project_datasets)} project resources")

    print("\n[Test 4] Searching for procurement datasets...")
    procurement_datasets = extractor.discover_procurement_data()
    print(f"Found {len(procurement_datasets)} procurement resources")

    print("\n" + "=" * 80)
    print(
        f"Total datasets discovered: {len(revenue_datasets + budget_datasets + project_datasets + procurement_datasets)}"
    )
    print("=" * 80)
