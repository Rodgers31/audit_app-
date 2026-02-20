"""Data validation utilities for ETL pipeline."""

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of data validation."""

    is_valid: bool
    confidence: float
    errors: List[str]
    warnings: List[str]
    metadata: Dict[str, Any]


class DataValidator:
    """Validate extracted data for quality and accuracy."""

    def __init__(self, db: Optional[Session] = None):
        self.db = db

    def validate_budget_data(self, data: Dict[str, Any]) -> ValidationResult:
        """Validate budget line data."""
        errors = []
        warnings = []
        confidence = 1.0

        # Check required fields
        required_fields = ["allocated_amount", "category", "entity_id", "period_id"]
        for field in required_fields:
            if field not in data or data[field] is None:
                errors.append(f"Missing required field: {field}")
                confidence -= 0.25

        # Validate amounts
        if "allocated_amount" in data:
            amount = data["allocated_amount"]
            if amount < 0:
                errors.append(f"Negative allocated amount: {amount}")
                confidence -= 0.3
            elif amount == 0:
                warnings.append("Allocated amount is zero")
                confidence -= 0.1
            elif amount > 1e12:  # 1 trillion threshold
                warnings.append(f"Unusually large amount: {amount}")
                confidence -= 0.15

        # Validate actual vs allocated
        if "actual_spent" in data and "allocated_amount" in data:
            actual = data["actual_spent"]
            allocated = data["allocated_amount"]
            if actual and allocated:
                variance = abs(actual - allocated) / allocated if allocated > 0 else 0
                if variance > 2.0:  # More than 200% variance
                    warnings.append(f"Large variance: {variance*100:.1f}%")
                    confidence -= 0.1

        # Check for data anomalies
        if "category" in data:
            category = str(data["category"]).strip()
            if len(category) < 3:
                warnings.append("Category name too short")
                confidence -= 0.05
            if category.isupper() or category.islower():
                warnings.append("Category has unusual casing")

        is_valid = len(errors) == 0 and confidence >= 0.6

        return ValidationResult(
            is_valid=is_valid,
            confidence=max(0.0, min(1.0, confidence)),
            errors=errors,
            warnings=warnings,
            metadata={"validated_at": datetime.utcnow().isoformat()},
        )

    def validate_audit_data(self, data: Dict[str, Any]) -> ValidationResult:
        """Validate audit finding data."""
        errors = []
        warnings = []
        confidence = 1.0

        required_fields = ["entity_id", "period_id", "finding_text", "severity"]
        for field in required_fields:
            if field not in data or data[field] is None:
                errors.append(f"Missing required field: {field}")
                confidence -= 0.25

        # Validate finding text
        if "finding_text" in data:
            text = str(data["finding_text"]).strip()
            if len(text) < 10:
                warnings.append("Finding text too short")
                confidence -= 0.1
            if len(text) > 10000:
                warnings.append("Finding text unusually long")

        # Validate severity
        valid_severities = ["info", "warning", "critical"]
        if "severity" in data:
            severity = str(data["severity"]).lower()
            if severity not in valid_severities:
                errors.append(f"Invalid severity: {severity}")
                confidence -= 0.2

        is_valid = len(errors) == 0 and confidence >= 0.6

        return ValidationResult(
            is_valid=is_valid,
            confidence=max(0.0, min(1.0, confidence)),
            errors=errors,
            warnings=warnings,
            metadata={"validated_at": datetime.utcnow().isoformat()},
        )

    def detect_duplicate(self, data: Dict[str, Any], doc_type: str) -> Optional[str]:
        """Detect if data is a duplicate by generating content hash."""
        # Create a canonical representation
        if doc_type == "budget":
            key_fields = [
                str(data.get("entity_id", "")),
                str(data.get("period_id", "")),
                str(data.get("category", "")),
                str(data.get("allocated_amount", "")),
            ]
        elif doc_type == "audit":
            key_fields = [
                str(data.get("entity_id", "")),
                str(data.get("period_id", "")),
                str(data.get("finding_text", ""))[:100],  # First 100 chars
            ]
        else:
            key_fields = [str(v) for v in data.values()]

        content = "|".join(key_fields)
        return hashlib.md5(content.encode()).hexdigest()

    def check_outliers(self, value: float, historical_values: List[float]) -> bool:
        """Check if a value is an outlier using statistical methods."""
        if not historical_values or len(historical_values) < 3:
            return False

        df = pd.DataFrame({"value": historical_values})
        mean = df["value"].mean()
        std = df["value"].std()

        if std == 0:
            return value != mean

        z_score = abs((value - mean) / std)
        return z_score > 3  # More than 3 standard deviations


class ConfidenceFilter:
    """Filter extracted data based on confidence scores."""

    def __init__(self, min_confidence: float = 0.6):
        self.min_confidence = min_confidence

    def should_accept(self, extraction: Dict[str, Any]) -> bool:
        """Determine if extraction should be accepted based on confidence."""
        confidence = extraction.get("confidence", 0.0)

        if confidence < self.min_confidence:
            logger.warning(
                f"Rejecting low-confidence extraction: {confidence:.2f} < {self.min_confidence}"
            )
            return False

        return True

    def create_review_queue_entry(self, extraction: Dict[str, Any]) -> Dict[str, Any]:
        """Create entry for manual review queue."""
        return {
            "extraction_id": extraction.get("id"),
            "confidence": extraction.get("confidence"),
            "reason": "Low confidence score",
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending_review",
            "data": extraction,
        }
