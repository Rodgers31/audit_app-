"""
Additional reliable Kenya government data sources
Focus on websites that are consistently accessible
"""

import json
import logging
from datetime import datetime

import requests

logger = logging.getLogger(__name__)


class AlternativeKenyaSources:
    """Alternative and more reliable Kenya government data sources."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )

    def test_kenya_open_data(self):
        """Test Kenya Open Data Portal - usually more reliable."""
        try:
            logger.info("📊 Testing Kenya Open Data Portal...")
            response = self.session.get("https://www.opendata.go.ke", timeout=15)

            if response.status_code == 200:
                return {
                    "source": "Kenya Open Data Portal",
                    "url": "https://www.opendata.go.ke",
                    "status": "accessible",
                    "description": "Government datasets and financial data",
                    "data_types": [
                        "budget_data",
                        "expenditure_data",
                        "economic_indicators",
                    ],
                    "reliability": "high",
                }
        except Exception as e:
            logger.warning(f"Kenya Open Data Portal failed: {str(e)}")

        return None

    def test_knbs(self):
        """Test Kenya National Bureau of Statistics."""
        try:
            logger.info("📈 Testing Kenya National Bureau of Statistics...")
            response = self.session.get("https://www.knbs.or.ke", timeout=15)

            if response.status_code == 200:
                return {
                    "source": "Kenya National Bureau of Statistics",
                    "url": "https://www.knbs.or.ke",
                    "status": "accessible",
                    "description": "Economic surveys and government statistics",
                    "data_types": [
                        "economic_surveys",
                        "statistical_abstracts",
                        "budget_analysis",
                    ],
                    "reliability": "high",
                }
        except Exception as e:
            logger.warning(f"KNBS failed: {str(e)}")

        return None

    def test_central_bank(self):
        """Test Central Bank of Kenya."""
        try:
            logger.info("🏦 Testing Central Bank of Kenya...")
            response = self.session.get("https://www.centralbank.go.ke", timeout=15)

            if response.status_code == 200:
                return {
                    "source": "Central Bank of Kenya",
                    "url": "https://www.centralbank.go.ke",
                    "status": "accessible",
                    "description": "Monetary policy and government debt data",
                    "data_types": [
                        "monetary_policy",
                        "government_debt",
                        "financial_stability",
                    ],
                    "reliability": "high",
                }
        except Exception as e:
            logger.warning(f"Central Bank failed: {str(e)}")

        return None

    def get_all_alternative_sources(self):
        """Get all working alternative sources."""
        sources = []

        # Test all alternative sources
        open_data = self.test_kenya_open_data()
        if open_data:
            sources.append(open_data)

        knbs = self.test_knbs()
        if knbs:
            sources.append(knbs)

        central_bank = self.test_central_bank()
        if central_bank:
            sources.append(central_bank)

        return sources


def get_mock_comprehensive_data():
    """Get comprehensive mock data based on real Kenya government structure."""
    return {
        "counties": [
            {"name": "Nairobi City", "budget": 35000000000, "population": 4500000},
            {"name": "Kiambu", "budget": 12000000000, "population": 2400000},
            {"name": "Nakuru", "budget": 15000000000, "population": 2162000},
            {"name": "Mombasa", "budget": 18000000000, "population": 1300000},
            {"name": "Machakos", "budget": 8000000000, "population": 1422000},
        ],
        "ministries": [
            {"name": "Health", "allocation": 150000000000, "execution": 93.3},
            {"name": "Education", "allocation": 300000000000, "execution": 95.0},
            {"name": "Infrastructure", "allocation": 250000000000, "execution": 92.0},
            {"name": "Interior", "allocation": 120000000000, "execution": 95.8},
            {"name": "Agriculture", "allocation": 80000000000, "execution": 93.8},
        ],
        "recent_audits": [
            {
                "entity": "Ministry of Health",
                "finding": "Budget variance of 15% in infrastructure projects",
                "severity": "medium",
                "amount": 22500000000,
            },
            {
                "entity": "Ministry of Education",
                "finding": "Minor documentation gaps in scholarship disbursements",
                "severity": "low",
                "amount": 5000000000,
            },
            {
                "entity": "Nairobi City County",
                "finding": "Delayed project implementation affecting 30% of budget",
                "severity": "medium",
                "amount": 10500000000,
            },
        ],
    }
