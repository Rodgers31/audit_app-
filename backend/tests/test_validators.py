"""Tests for data validation utilities."""

import pytest
from validators.data_validator import ConfidenceFilter, DataValidator, ValidationResult


class TestDataValidator:
    """Test data validation functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.validator = DataValidator()

    def test_valid_budget_data(self):
        """Test validation of valid budget data."""
        data = {
            "entity_id": 1,
            "period_id": 1,
            "category": "Health Services",
            "allocated_amount": 1000000.00,
            "actual_spent": 950000.00,
        }
        result = self.validator.validate_budget_data(data)
        assert result.is_valid
        assert result.confidence > 0.7

    def test_negative_amount_rejected(self):
        """Test negative amounts are rejected."""
        data = {
            "entity_id": 1,
            "period_id": 1,
            "category": "Health Services",
            "allocated_amount": -1000.00,
        }
        result = self.validator.validate_budget_data(data)
        assert not result.is_valid
        assert len(result.errors) > 0
        assert any("negative" in err.lower() for err in result.errors)

    def test_missing_required_fields(self):
        """Test missing required fields are detected."""
        data = {
            "category": "Health Services",
        }
        result = self.validator.validate_budget_data(data)
        assert not result.is_valid
        assert len(result.errors) >= 3  # Missing entity_id, period_id, allocated_amount

    def test_large_variance_warning(self):
        """Test large variance triggers warning."""
        data = {
            "entity_id": 1,
            "period_id": 1,
            "category": "Health Services",
            "allocated_amount": 1000000.00,
            "actual_spent": 5000000.00,  # 500% of allocated
        }
        result = self.validator.validate_budget_data(data)
        assert len(result.warnings) > 0
        assert any("variance" in warn.lower() for warn in result.warnings)

    def test_audit_data_validation(self):
        """Test audit data validation."""
        data = {
            "entity_id": 1,
            "period_id": 1,
            "finding_text": "Missing documentation for procurement process",
            "severity": "warning",
        }
        result = self.validator.validate_audit_data(data)
        assert result.is_valid

    def test_invalid_audit_severity(self):
        """Test invalid audit severity is rejected."""
        data = {
            "entity_id": 1,
            "period_id": 1,
            "finding_text": "Some finding",
            "severity": "invalid_severity",
        }
        result = self.validator.validate_audit_data(data)
        assert not result.is_valid

    def test_duplicate_detection(self):
        """Test duplicate detection generates consistent hashes."""
        data1 = {
            "entity_id": 1,
            "period_id": 1,
            "category": "Health",
            "allocated_amount": 1000000,
        }
        data2 = {
            "entity_id": 1,
            "period_id": 1,
            "category": "Health",
            "allocated_amount": 1000000,
        }
        hash1 = self.validator.detect_duplicate(data1, "budget")
        hash2 = self.validator.detect_duplicate(data2, "budget")
        assert hash1 == hash2

    def test_different_data_different_hash(self):
        """Test different data generates different hashes."""
        data1 = {
            "entity_id": 1,
            "period_id": 1,
            "category": "Health",
            "allocated_amount": 1000000,
        }
        data2 = {
            "entity_id": 1,
            "period_id": 1,
            "category": "Education",
            "allocated_amount": 1000000,
        }
        hash1 = self.validator.detect_duplicate(data1, "budget")
        hash2 = self.validator.detect_duplicate(data2, "budget")
        assert hash1 != hash2

    def test_outlier_detection(self):
        """Test outlier detection using statistical methods."""
        historical = [1000000, 1100000, 900000, 1050000, 980000]
        outlier = 5000000  # Way outside normal range

        is_outlier = self.validator.check_outliers(outlier, historical)
        assert is_outlier

    def test_normal_value_not_outlier(self):
        """Test normal values are not flagged as outliers."""
        historical = [1000000, 1100000, 900000, 1050000, 980000]
        normal = 1020000

        is_outlier = self.validator.check_outliers(normal, historical)
        assert not is_outlier


class TestConfidenceFilter:
    """Test confidence filtering."""

    def test_accept_high_confidence(self):
        """Test high confidence extractions are accepted."""
        filter = ConfidenceFilter(min_confidence=0.7)
        extraction = {"confidence": 0.85, "data": "some data"}
        assert filter.should_accept(extraction)

    def test_reject_low_confidence(self):
        """Test low confidence extractions are rejected."""
        filter = ConfidenceFilter(min_confidence=0.7)
        extraction = {"confidence": 0.5, "data": "some data"}
        assert not filter.should_accept(extraction)

    def test_review_queue_creation(self):
        """Test review queue entry creation."""
        filter = ConfidenceFilter()
        extraction = {"id": 123, "confidence": 0.5, "data": "some data"}
        entry = filter.create_review_queue_entry(extraction)

        assert entry["extraction_id"] == 123
        assert entry["status"] == "pending_review"
        assert "created_at" in entry
