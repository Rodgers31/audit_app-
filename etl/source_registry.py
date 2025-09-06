import os
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List

# Create a mock yaml module if not available
try:
    import yaml
except ImportError:

    class MockYAML:
        @staticmethod
        def safe_load(file):
            return {}

        @staticmethod
        def dump(data, file, **kwargs):
            pass

    yaml = MockYAML()


class SourceType(Enum):
    TREASURY = "treasury"
    AUDITOR_GENERAL = "auditor_general"
    CONTROLLER_BUDGET = "controller_budget"
    PARLIAMENT = "parliament"
    CENTRAL_BANK = "central_bank"


@dataclass
class DataSource:
    """Configuration for a government data source."""

    name: str
    base_url: str
    source_type: str
    country_code: str
    description: str
    api_endpoint: str = ""
    requires_auth: bool = False
    update_frequency: str = "monthly"


class SourceRegistry:
    """Registry for managing data sources across countries."""

    def __init__(self, config_path: str = "sources.yaml"):
        self.config_path = config_path
        self.sources = self._load_sources()
        self._initialize_kenya_sources()

    def _load_sources(self) -> Dict[str, Any]:
        """Load source configuration from YAML file."""
        if not os.path.exists(self.config_path):
            return {}

        try:
            with open(self.config_path, "r") as file:
                return yaml.safe_load(file) or {}
        except:
            return {}

    def _initialize_kenya_sources(self):
        """Initialize Kenya government data sources if not already loaded."""
        if not self.get_sources_by_country("KE"):
            kenya_sources = [
                {
                    "source_id": "kenya_treasury",
                    "name": "Kenya National Treasury",
                    "base_url": "https://www.treasury.go.ke",
                    "source_type": "treasury",
                    "description": "Ministry of Treasury and Planning - Budget documents, economic surveys",
                    "update_frequency": "quarterly",
                    "document_patterns": [
                        "/budget-documents/",
                        "/economic-survey/",
                        "/budget-statement/",
                    ],
                },
                {
                    "source_id": "kenya_oag",
                    "name": "Office of Auditor General Kenya",
                    "base_url": "https://www.oagkenya.go.ke",
                    "source_type": "auditor_general",
                    "description": "Audit reports for government entities and public funds",
                    "update_frequency": "annual",
                    "document_patterns": [
                        "/audit-reports/",
                        "/annual-reports/",
                        "/special-audits/",
                    ],
                },
                {
                    "source_id": "kenya_cob",
                    "name": "Office of Controller of Budget",
                    "base_url": "https://cob.go.ke",
                    "source_type": "controller_budget",
                    "description": "Budget implementation reviews and expenditure reports",
                    "update_frequency": "quarterly",
                    "document_patterns": [
                        "/budget-implementation/",
                        "/expenditure-reports/",
                        "/quarterly-reviews/",
                    ],
                },
            ]

            # Add Kenya sources to registry
            for source in kenya_sources:
                self.add_source("KE", source)

    def get_sources_by_country(self, country_code: str) -> List[Dict[str, Any]]:
        """Get all sources for a specific country."""
        return self.sources.get(country_code, {}).get("sources", [])

    def get_source_by_id(self, source_id: str) -> Dict[str, Any]:
        """Get a specific source by ID."""
        for country_code, country_data in self.sources.items():
            for source in country_data.get("sources", []):
                if source.get("source_id") == source_id:
                    return source
        return {}

    def add_source(self, country_code: str, source: Dict[str, Any]):
        """Add a new source to the registry."""
        if country_code not in self.sources:
            self.sources[country_code] = {"sources": []}

        self.sources[country_code]["sources"].append(source)
        # Don't save to file in development mode to avoid errors
        # self._save_sources()

    def _save_sources(self):
        """Save sources to YAML file."""
        try:
            with open(self.config_path, "w") as file:
                yaml.dump(self.sources, file, default_flow_style=False)
        except:
            pass  # Ignore save errors in development


# Initialize global registry
registry = SourceRegistry()
