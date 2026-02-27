"""
Tests for budget, debt, and fiscal endpoints.

Covers:
  GET /api/v1/budget/national
  GET /api/v1/budget/utilization
  GET /api/v1/budget/overview
  GET /api/v1/budget/enhanced
  GET /api/v1/debt/timeline
  GET /api/v1/debt/top-loans
  GET /api/v1/debt/loans
  GET /api/v1/debt/national
  GET /api/v1/fiscal/summary
  GET /api/v1/pending-bills
"""

from datetime import datetime

import pytest
from models import (
    BudgetLine,
    DebtCategory,
    DebtTimeline,
    Entity,
    EntityType,
    FiscalPeriod,
    FiscalSummary,
    Loan,
)


@pytest.fixture()
def seed_budget_data(db_session, seed_country, seed_source_doc):
    """Seed budget, debt timeline, and fiscal summary data."""
    entity = Entity(
        id=30,
        country_id=seed_country.id,
        type=EntityType.NATIONAL,
        canonical_name="National Treasury",
        slug="national-treasury",
    )
    db_session.add(entity)
    db_session.flush()

    fp = FiscalPeriod(
        id=30,
        country_id=seed_country.id,
        label="FY2024/25",
        start_date=datetime(2024, 7, 1),
        end_date=datetime(2025, 6, 30),
    )
    db_session.add(fp)
    db_session.flush()

    # Budget line
    bl = BudgetLine(
        entity_id=entity.id,
        period_id=fp.id,
        category="Education",
        allocated_amount=500_000_000_000,
        actual_spent=420_000_000_000,
        currency="KES",
        source_document_id=seed_source_doc.id,
    )
    db_session.add(bl)

    # Debt timeline entry
    dt = DebtTimeline(
        year=2024,
        external=3_500_000_000_000,
        domestic=4_800_000_000_000,
        total=8_300_000_000_000,
        gdp=14_000_000_000_000,
        gdp_ratio=59.3,
    )
    db_session.add(dt)

    # Fiscal summary
    fs = FiscalSummary(
        fiscal_year="2024/25",
        appropriated_budget=3_600_000_000_000,
        total_revenue=2_800_000_000_000,
        tax_revenue=2_200_000_000_000,
        non_tax_revenue=400_000_000_000,
        total_borrowing=800_000_000_000,
        debt_service_cost=1_000_000_000_000,
        development_spending=700_000_000_000,
        recurrent_spending=2_100_000_000_000,
        county_allocation=400_000_000_000,
    )
    db_session.add(fs)

    # Loan
    loan = Loan(
        entity_id=entity.id,
        lender="China EXIM Bank",
        debt_category=DebtCategory.EXTERNAL_BILATERAL,
        principal=500_000_000_000,
        outstanding=350_000_000_000,
        currency="KES",
        source_document_id=seed_source_doc.id,
        issue_date=datetime(2018, 6, 1),
    )
    db_session.add(loan)

    db_session.commit()
    return entity


class TestNationalBudget:
    """Tests for GET /api/v1/budget/national."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/budget/national")
        assert response.status_code == 200

    def test_returns_data_structure(self, client, seed_budget_data):
        data = client.get("/api/v1/budget/national").json()
        assert isinstance(data, (dict, list))


class TestBudgetUtilization:
    """Tests for GET /api/v1/budget/utilization."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/budget/utilization")
        assert response.status_code == 200


class TestBudgetOverview:
    """Tests for GET /api/v1/budget/overview."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/budget/overview")
        assert response.status_code == 200

    def test_returns_overview_data(self, client, seed_budget_data):
        data = client.get("/api/v1/budget/overview").json()
        assert isinstance(data, (dict, list))


class TestBudgetEnhanced:
    """Tests for GET /api/v1/budget/enhanced."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/budget/enhanced")
        assert response.status_code == 200


class TestDebtTimeline:
    """Tests for GET /api/v1/debt/timeline."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/debt/timeline")
        assert response.status_code == 200

    def test_returns_timeline_data(self, client, seed_budget_data):
        data = client.get("/api/v1/debt/timeline").json()
        assert isinstance(data, (dict, list))


class TestDebtTopLoans:
    """Tests for GET /api/v1/debt/top-loans."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/debt/top-loans")
        assert response.status_code == 200


class TestDebtLoans:
    """Tests for GET /api/v1/debt/loans."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/debt/loans")
        assert response.status_code == 200

    def test_returns_loans_data(self, client, seed_budget_data):
        data = client.get("/api/v1/debt/loans").json()
        assert isinstance(data, (dict, list))


class TestDebtNational:
    """Tests for GET /api/v1/debt/national."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/debt/national")
        assert response.status_code == 200


class TestFiscalSummary:
    """Tests for GET /api/v1/fiscal/summary."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/fiscal/summary")
        assert response.status_code == 200

    def test_returns_fiscal_data(self, client, seed_budget_data):
        data = client.get("/api/v1/fiscal/summary").json()
        assert isinstance(data, (dict, list))


class TestPendingBills:
    """Tests for GET /api/v1/pending-bills."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/pending-bills")
        assert response.status_code == 200

    def test_returns_data(self, client):
        data = client.get("/api/v1/pending-bills").json()
        assert isinstance(data, (dict, list))
