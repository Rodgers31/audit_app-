"""
Data normalizer for converting extracted data into canonical format
Handles entity name mapping, fiscal year normalization, and currency conversion
"""

import json
import logging
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from fuzzywuzzy import fuzz

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataNormalizer:
    """
    Normalizes extracted financial data into canonical database format
    """

    def __init__(self):
        # Load entity mappings for Kenya
        self.entity_mappings = self._load_entity_mappings()
        self.fiscal_year_patterns = self._load_fiscal_year_patterns()
        self.currency_patterns = self._load_currency_patterns()

    def _load_entity_mappings(self) -> Dict[str, Any]:
        """Load canonical entity mappings for Kenya"""
        return {
            "counties": {
                "nairobi": {
                    "canonical_name": "Nairobi County",
                    "code": "047",
                    "type": "county",
                },
                "mombasa": {
                    "canonical_name": "Mombasa County",
                    "code": "001",
                    "type": "county",
                },
                "kisumu": {
                    "canonical_name": "Kisumu County",
                    "code": "042",
                    "type": "county",
                },
                "nakuru": {
                    "canonical_name": "Nakuru County",
                    "code": "032",
                    "type": "county",
                },
                "uasin gishu": {
                    "canonical_name": "Uasin Gishu County",
                    "code": "027",
                    "type": "county",
                },
                "machakos": {
                    "canonical_name": "Machakos County",
                    "code": "016",
                    "type": "county",
                },
                "kiambu": {
                    "canonical_name": "Kiambu County",
                    "code": "022",
                    "type": "county",
                },
                # Add all 47 counties...
            },
            "ministries": {
                "health": {"canonical_name": "Ministry of Health", "type": "ministry"},
                "education": {
                    "canonical_name": "Ministry of Education",
                    "type": "ministry",
                },
                "treasury": {"canonical_name": "National Treasury", "type": "ministry"},
                "defense": {
                    "canonical_name": "Ministry of Defense",
                    "type": "ministry",
                },
                "interior": {
                    "canonical_name": "Ministry of Interior and National Administration",
                    "type": "ministry",
                },
                "transport": {
                    "canonical_name": "Ministry of Transport and Infrastructure",
                    "type": "ministry",
                },
                "agriculture": {
                    "canonical_name": "Ministry of Agriculture and Livestock Development",
                    "type": "ministry",
                },
            },
            "agencies": {
                "kra": {"canonical_name": "Kenya Revenue Authority", "type": "agency"},
                "kenha": {
                    "canonical_name": "Kenya National Highways Authority",
                    "type": "agency",
                },
                "nema": {
                    "canonical_name": "National Environment Management Authority",
                    "type": "agency",
                },
            },
        }

    def _load_fiscal_year_patterns(self) -> List[Dict[str, Any]]:
        """Define fiscal year patterns for Kenya (July-June)"""
        return [
            {
                "pattern": r"FY\s*(\d{4})[\/\-](\d{2,4})",
                "format": "FY YYYY/YY",
                "example": "FY 2024/25",
            },
            {
                "pattern": r"(\d{4})[\/\-](\d{2,4})\s*FY",
                "format": "YYYY/YY FY",
                "example": "2024/25 FY",
            },
            {
                "pattern": r"Financial\s+Year\s+(\d{4})[\/\-](\d{2,4})",
                "format": "Financial Year YYYY/YY",
                "example": "Financial Year 2024/25",
            },
        ]

    def _load_currency_patterns(self) -> Dict[str, Any]:
        """Define currency patterns and conversion rates"""
        return {
            "KES": {
                "symbols": ["KES", "KSh", "Ksh", "Kshs", "K.Sh"],
                "patterns": [
                    r"KES\s*([\d,\.]+)",
                    r"K[Ss]h\.?\s*([\d,\.]+)",
                    r"([\d,\.]+)\s*KES",
                    r"([\d,\.]+)\s*K[Ss]h",
                ],
                "base_currency": "KES",
                "rate": 1.0,
            },
            "USD": {
                "symbols": ["USD", "$", "US$"],
                "patterns": [
                    r"USD\s*([\d,\.]+)",
                    r"\$\s*([\d,\.]+)",
                    r"US\$\s*([\d,\.]+)",
                ],
                "base_currency": "KES",
                "rate": 145.0,  # Approximate rate - should be dynamic
            },
        }

    def normalize_entity_name(self, raw_name: str) -> Optional[Dict[str, Any]]:
        """
        Normalize entity names to canonical form using fuzzy matching
        """
        if not raw_name:
            return None

        raw_name_clean = raw_name.strip().lower()

        # Try exact matches first
        for category, entities in self.entity_mappings.items():
            for key, entity_info in entities.items():
                if key == raw_name_clean:
                    return {
                        "canonical_name": entity_info["canonical_name"],
                        "type": entity_info["type"],
                        "category": category,
                        "confidence": 1.0,
                        "raw_name": raw_name,
                    }

        # Try fuzzy matching
        best_match = None
        best_score = 0

        for category, entities in self.entity_mappings.items():
            for key, entity_info in entities.items():
                # Check against canonical name
                score1 = fuzz.ratio(
                    raw_name_clean, entity_info["canonical_name"].lower()
                )
                score2 = fuzz.ratio(raw_name_clean, key)

                score = max(score1, score2)

                if score > best_score and score > 70:  # Minimum confidence threshold
                    best_score = score
                    best_match = {
                        "canonical_name": entity_info["canonical_name"],
                        "type": entity_info["type"],
                        "category": category,
                        "confidence": score / 100.0,
                        "raw_name": raw_name,
                    }

        return best_match

    def normalize_fiscal_period(self, raw_period: str) -> Optional[Dict[str, Any]]:
        """
        Normalize fiscal year/period to canonical format
        Kenya FY runs July 1 - June 30
        """
        if not raw_period:
            return None

        raw_period_clean = raw_period.strip()

        for pattern_info in self.fiscal_year_patterns:
            match = re.search(pattern_info["pattern"], raw_period_clean, re.IGNORECASE)

            if match:
                year1 = int(match.group(1))
                year2_str = match.group(2)

                # Handle 2-digit vs 4-digit second year
                if len(year2_str) == 2:
                    year2 = int(f"20{year2_str}")
                else:
                    year2 = int(year2_str)

                # Kenya FY starts in July
                start_date = date(year1, 7, 1)
                end_date = date(year2, 6, 30)

                return {
                    "label": f"FY{year1}/{str(year2)[2:]}",
                    "start_date": start_date,
                    "end_date": end_date,
                    "raw_period": raw_period,
                    "confidence": 0.9,
                }

        # Try to extract just years
        year_match = re.search(r"(\d{4})", raw_period_clean)
        if year_match:
            year = int(year_match.group(1))
            return {
                "label": f"FY{year}/{str(year+1)[2:]}",
                "start_date": date(year, 7, 1),
                "end_date": date(year + 1, 6, 30),
                "raw_period": raw_period,
                "confidence": 0.5,
            }

        return None

    def normalize_amount(
        self, raw_amount: str, context: str = ""
    ) -> Optional[Dict[str, Any]]:
        """
        Extract and normalize monetary amounts
        """
        if not raw_amount:
            return None

        raw_amount_clean = str(raw_amount).strip().replace(",", "")

        # Try to detect currency and extract amount
        for currency, currency_info in self.currency_patterns.items():
            for pattern in currency_info["patterns"]:
                match = re.search(pattern, raw_amount_clean, re.IGNORECASE)

                if match:
                    amount_str = match.group(1).replace(",", "")

                    try:
                        amount = Decimal(amount_str)

                        # Handle millions/billions notation
                        if (
                            "million" in raw_amount_clean.lower()
                            or "m" in context.lower()
                        ):
                            amount *= 1_000_000
                        elif (
                            "billion" in raw_amount_clean.lower()
                            or "b" in context.lower()
                        ):
                            amount *= 1_000_000_000
                        elif (
                            "thousand" in raw_amount_clean.lower()
                            or "k" in context.lower()
                        ):
                            amount *= 1_000

                        return {
                            "amount": float(amount),
                            "currency": currency,
                            "base_amount": float(
                                amount * Decimal(str(currency_info["rate"]))
                            ),
                            "base_currency": currency_info["base_currency"],
                            "raw_amount": raw_amount,
                            "confidence": 0.8,
                        }

                    except (ValueError, TypeError):
                        continue

        # Fallback: try to extract just numbers
        number_match = re.search(r"([\d,\.]+)", raw_amount_clean)
        if number_match:
            try:
                amount = Decimal(number_match.group(1).replace(",", ""))
                return {
                    "amount": float(amount),
                    "currency": "KES",  # Default to KES for Kenya
                    "base_amount": float(amount),
                    "base_currency": "KES",
                    "raw_amount": raw_amount,
                    "confidence": 0.3,
                }
            except (ValueError, TypeError):
                pass

        return None

    def normalize_extracted_data(
        self, extraction_result: Dict[str, Any], source_key: str, doc_type: str
    ) -> List[Dict[str, Any]]:
        """
        Normalize extracted table data into budget line format
        """
        normalized_items = []

        if not extraction_result.get("tables"):
            logger.warning("No tables found in extraction result")
            return normalized_items

        for table_data in extraction_result["tables"]:
            table_items = self._normalize_table(table_data, source_key, doc_type)
            normalized_items.extend(table_items)

        logger.info(f"Normalized {len(normalized_items)} items from {source_key}")
        return normalized_items

    def _normalize_table(
        self, table_data: Dict[str, Any], source_key: str, doc_type: str
    ) -> List[Dict[str, Any]]:
        """Normalize a single table into budget line items"""
        items = []

        headers = table_data.get("headers", [])
        rows = table_data.get("rows", [])

        if not headers or not rows:
            return items

        # Try to identify key columns
        column_mapping = self._identify_columns(headers)

        for row_idx, row in enumerate(rows):
            if len(row) != len(headers):
                continue  # Skip malformed rows

            item = self._normalize_row(
                row, column_mapping, headers, source_key, doc_type
            )
            if item:
                item["source_table"] = {
                    "page": table_data.get("page", 1),
                    "table_index": table_data.get("table_index", 0),
                    "row_index": row_idx,
                }
                items.append(item)

        return items

    def _identify_columns(self, headers: List[str]) -> Dict[str, int]:
        """Identify which columns contain what type of data"""
        mapping = {}

        for i, header in enumerate(headers):
            header_lower = str(header).lower().strip()

            # Entity/Department/County
            if any(
                keyword in header_lower
                for keyword in ["entity", "department", "ministry", "county", "agency"]
            ):
                mapping["entity"] = i
            elif any(
                keyword in header_lower for keyword in ["name", "description", "item"]
            ):
                mapping["entity"] = i

            # Budget allocations
            elif any(
                keyword in header_lower
                for keyword in ["allocation", "budget", "approved"]
            ):
                mapping["allocated"] = i

            # Actual spending
            elif any(
                keyword in header_lower
                for keyword in ["actual", "spent", "expenditure", "disbursed"]
            ):
                mapping["actual"] = i

            # Category
            elif any(
                keyword in header_lower
                for keyword in ["category", "programme", "sector"]
            ):
                mapping["category"] = i

            # Period/Year
            elif any(keyword in header_lower for keyword in ["year", "period", "fy"]):
                mapping["period"] = i

        return mapping

    def _normalize_row(
        self,
        row: List[Any],
        column_mapping: Dict[str, int],
        headers: List[str],
        source_key: str,
        doc_type: str,
    ) -> Optional[Dict[str, Any]]:
        """Normalize a single table row into a budget line item"""

        try:
            item = {
                "raw_data": {
                    "row": row,
                    "headers": headers,
                    "source_key": source_key,
                    "doc_type": doc_type,
                },
                "extraction_metadata": {
                    "extraction_date": datetime.now().isoformat(),
                    "confidence": 0.7,
                },
            }

            # Extract entity
            if "entity" in column_mapping:
                entity_raw = str(row[column_mapping["entity"]]).strip()
                entity_normalized = self.normalize_entity_name(entity_raw)
                if entity_normalized:
                    item["entity"] = entity_normalized
                else:
                    item["entity"] = {
                        "canonical_name": entity_raw,
                        "type": "unknown",
                        "confidence": 0.1,
                        "raw_name": entity_raw,
                    }

            # Extract allocated amount
            if "allocated" in column_mapping:
                allocated_raw = str(row[column_mapping["allocated"]]).strip()
                allocated_normalized = self.normalize_amount(allocated_raw)
                if allocated_normalized:
                    item["allocated_amount"] = allocated_normalized

            # Extract actual amount
            if "actual" in column_mapping:
                actual_raw = str(row[column_mapping["actual"]]).strip()
                actual_normalized = self.normalize_amount(actual_raw)
                if actual_normalized:
                    item["actual_amount"] = actual_normalized

            # Extract category
            if "category" in column_mapping:
                item["category"] = str(row[column_mapping["category"]]).strip()

            # Extract period
            if "period" in column_mapping:
                period_raw = str(row[column_mapping["period"]]).strip()
                period_normalized = self.normalize_fiscal_period(period_raw)
                if period_normalized:
                    item["fiscal_period"] = period_normalized

            # Only return items with at least entity and some amount
            if "entity" in item and (
                "allocated_amount" in item or "actual_amount" in item
            ):
                return item

        except Exception as e:
            logger.error(f"Error normalizing row {row}: {e}")

        return None


if __name__ == "__main__":
    # Test the normalizer
    normalizer = DataNormalizer()

    # Test entity normalization
    test_entities = ["Ministry of Health", "Nairobi County", "KRA"]
    for entity in test_entities:
        result = normalizer.normalize_entity_name(entity)
        print(f"Entity: {entity} -> {result}")

    # Test amount normalization
    test_amounts = ["KES 1,500,000", "Ksh 2.5 billion", "$100 million"]
    for amount in test_amounts:
        result = normalizer.normalize_amount(amount)
        print(f"Amount: {amount} -> {result}")

    # Test fiscal period normalization
    test_periods = ["FY 2024/25", "Financial Year 2023/24", "2024/2025"]
    for period in test_periods:
        result = normalizer.normalize_fiscal_period(period)
        print(f"Period: {period} -> {result}")
