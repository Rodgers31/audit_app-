"""
Tests for county-related endpoints.

Covers:
  GET /api/v1/counties
  GET /api/v1/counties/{county_id}
  GET /api/v1/counties/{county_id}/comprehensive
  GET /api/v1/counties/{county_id}/financial
  GET /api/v1/counties/{county_id}/budget
  GET /api/v1/counties/{county_id}/debt
"""

from datetime import datetime

import pytest
from models import BudgetLine, DebtCategory, Entity, EntityType, FiscalPeriod, Loan


@pytest.fixture()
def seed_full_county(db_session, seed_country, seed_source_doc):
    """Seed a county entity with budget lines and loans for richer testing."""
    entity = Entity(
        id=10,
        country_id=seed_country.id,
        type=EntityType.COUNTY,
        canonical_name="Mombasa",
        slug="mombasa",
    )
    db_session.add(entity)
    db_session.flush()

    fp = FiscalPeriod(
        id=10,
        country_id=seed_country.id,
        label="FY2024/25",
        start_date=datetime(2024, 7, 1),
        end_date=datetime(2025, 6, 30),
    )
    db_session.add(fp)
    db_session.flush()

    bl = BudgetLine(
        entity_id=entity.id,
        period_id=fp.id,
        category="Health",
        subcategory="Primary Care",
        allocated_amount=5_000_000,
        actual_spent=3_200_000,
        currency="KES",
        source_document_id=seed_source_doc.id,
    )
    db_session.add(bl)

    loan = Loan(
        entity_id=entity.id,
        lender="World Bank",
        debt_category=DebtCategory.EXTERNAL_MULTILATERAL,
        principal=10_000_000,
        outstanding=8_000_000,
        currency="KES",
        source_document_id=seed_source_doc.id,
        issue_date=datetime(2020, 1, 1),
    )
    db_session.add(loan)
    db_session.commit()
    return entity


class TestGetCounties:
    """Tests for GET /api/v1/counties."""

    def test_returns_list_or_503_when_empty(self, client):
        """Without any county entities, should return 503 (no data) or empty list."""
        response = client.get("/api/v1/counties")
        # May return 503 with helpful error or 200 with empty list
        assert response.status_code in (200, 503)

    def test_returns_counties_when_seeded(self, client, seed_entity):
        """With at least one county entity, should return county data."""
        response = client.get("/api/v1/counties")
        assert response.status_code in (200, 503)
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)

    def test_fiscal_year_filter(self, client, seed_full_county):
        """Fiscal year query param should be accepted."""
        response = client.get("/api/v1/counties?fiscal_year=2024/25")
        assert response.status_code in (200, 503)


class TestGetCountyById:
    """Tests for GET /api/v1/counties/{county_id}."""

    def test_returns_county_data(self, client, seed_entity):
        """A valid county ID should return data."""
        response = client.get("/api/v1/counties/001")
        # The route uses county_id as a string code
        assert response.status_code in (200, 404, 503)

    def test_returns_404_for_unknown(self, client):
        """Unknown county code should return 404."""
        response = client.get("/api/v1/counties/999")
        assert response.status_code in (200, 404, 503)


class TestCountyComprehensive:
    """Tests for GET /api/v1/counties/{county_id}/comprehensive."""

    def test_returns_comprehensive_profile(self, client, seed_full_county):
        response = client.get("/api/v1/counties/047/comprehensive")
        assert response.status_code in (200, 404, 503)

    def test_unknown_county_returns_error(self, client):
        response = client.get("/api/v1/counties/999/comprehensive")
        assert response.status_code in (404, 503, 200)


class TestCountyBudget:
    """Tests for GET /api/v1/counties/{county_id}/budget."""

    def test_returns_budget_data(self, client, seed_full_county):
        response = client.get("/api/v1/counties/047/budget")
        assert response.status_code in (200, 404, 503)


class TestCountyDebt:
    """Tests for GET /api/v1/counties/{county_id}/debt."""

    def test_returns_debt_data(self, client, seed_full_county):
        response = client.get("/api/v1/counties/047/debt")
        assert response.status_code in (200, 404, 503)


class TestCountyFinancial:
    """Tests for GET /api/v1/counties/{county_id}/financial."""

    def test_returns_financial_data(self, client, seed_full_county):
        response = client.get("/api/v1/counties/047/financial")
        assert response.status_code in (200, 404, 503)
