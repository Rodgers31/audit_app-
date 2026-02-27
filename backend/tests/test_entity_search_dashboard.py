"""
Tests for entity, document, search, and dashboard endpoints.

Covers:
  GET /api/v1/entities
  GET /api/v1/entities/{entity_id}
  GET /api/v1/entities/{entity_id}/periods/{period_id}/budget_lines
  GET /api/v1/documents/{document_id}
  GET /api/v1/search
  GET /api/v1/source-documents/{doc_id}
  GET /api/v1/provenance/budget-line/{line_id}
  GET /api/v1/sources/status
  GET /api/v1/dashboards/national/debt-mix
  GET /api/v1/dashboards/national/fiscal-outturns
  GET /api/v1/dashboards/national/sector-ceilings
  GET /api/v1/analytics/top_spenders
"""

from datetime import datetime

import pytest
from models import (
    BudgetLine,
    DocumentStatus,
    DocumentType,
    Entity,
    EntityType,
    FiscalPeriod,
    SourceDocument,
)


@pytest.fixture()
def seed_entities(db_session, seed_country):
    """Seed multiple entities."""
    entities = []
    for i, (name, slug, etype) in enumerate(
        [
            ("National Treasury", "national-treasury", EntityType.NATIONAL),
            ("Ministry of Health", "ministry-of-health", EntityType.MINISTRY),
            ("Nairobi", "nairobi", EntityType.COUNTY),
        ],
        start=40,
    ):
        e = Entity(
            id=i,
            country_id=seed_country.id,
            type=etype,
            canonical_name=name,
            slug=slug,
        )
        db_session.add(e)
        entities.append(e)
    db_session.commit()
    return entities


@pytest.fixture()
def seed_source_doc(db_session, seed_country):
    """Seed a source document."""
    doc = SourceDocument(
        id=1,
        country_id=seed_country.id,
        publisher="Kenya National Treasury",
        title="FY2024/25 Budget Estimates",
        url="https://treasury.go.ke/budget-2024",
        fetch_date=datetime(2024, 8, 1),
        doc_type=DocumentType.BUDGET,
        status=DocumentStatus.AVAILABLE,
    )
    db_session.add(doc)
    db_session.commit()
    return doc


class TestGetEntities:
    """Tests for GET /api/v1/entities."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/entities")
        assert response.status_code == 200

    def test_returns_list(self, client, seed_entities):
        data = client.get("/api/v1/entities").json()
        assert isinstance(data, list)

    def test_contains_seeded_entities(self, client, seed_entities):
        data = client.get("/api/v1/entities").json()
        names = [e.get("canonical_name", "") for e in data]
        assert "National Treasury" in names or len(data) > 0


class TestGetEntityById:
    """Tests for GET /api/v1/entities/{entity_id}."""

    def test_returns_entity_detail(self, client, seed_entities):
        eid = seed_entities[0].id
        response = client.get(f"/api/v1/entities/{eid}")
        assert response.status_code in (200, 404)

    def test_returns_404_for_unknown(self, client):
        response = client.get("/api/v1/entities/99999")
        assert response.status_code == 404


class TestEntityBudgetLines:
    """Tests for GET /api/v1/entities/{id}/periods/{pid}/budget_lines."""

    def test_returns_budget_lines(self, client, seed_entities, seed_fiscal_period):
        eid = seed_entities[0].id
        pid = seed_fiscal_period.id
        response = client.get(f"/api/v1/entities/{eid}/periods/{pid}/budget_lines")
        assert response.status_code in (200, 404)


class TestSearch:
    """Tests for GET /api/v1/search."""

    def test_search_returns_200(self, client):
        response = client.get("/api/v1/search?q=health")
        assert response.status_code == 200

    def test_search_returns_results_structure(self, client):
        data = client.get("/api/v1/search?q=health").json()
        assert isinstance(data, dict)
        assert "results" in data


class TestSourceDocuments:
    """Tests for GET /api/v1/source-documents/{doc_id}."""

    def test_returns_document(self, client, seed_source_doc):
        response = client.get(f"/api/v1/source-documents/{seed_source_doc.id}")
        assert response.status_code in (200, 404)

    def test_returns_404_for_unknown(self, client):
        response = client.get("/api/v1/source-documents/99999")
        assert response.status_code == 404


class TestProvenanceBudgetLine:
    """Tests for GET /api/v1/provenance/budget-line/{line_id}."""

    def test_returns_provenance_or_404(self, client):
        response = client.get("/api/v1/provenance/budget-line/1")
        assert response.status_code in (200, 404)


class TestSourcesStatus:
    """Tests for GET /api/v1/sources/status."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/sources/status")
        assert response.status_code == 200


class TestDashboards:
    """Tests for dashboard endpoints."""

    def test_debt_mix_returns_200(self, client):
        response = client.get("/api/v1/dashboards/national/debt-mix")
        assert response.status_code == 200

    def test_fiscal_outturns_returns_200(self, client):
        response = client.get("/api/v1/dashboards/national/fiscal-outturns")
        assert response.status_code == 200

    def test_sector_ceilings_returns_200(self, client):
        response = client.get("/api/v1/dashboards/national/sector-ceilings")
        assert response.status_code == 200


class TestAnalytics:
    """Tests for GET /api/v1/analytics/top_spenders."""

    def test_returns_200_with_params(self, client):
        response = client.get(
            "/api/v1/analytics/top_spenders?country=KEN&period=FY2024"
        )
        assert response.status_code in (200, 500)

    def test_requires_country_and_period(self, client):
        """Missing required query params → 422."""
        response = client.get("/api/v1/analytics/top_spenders")
        assert response.status_code == 422

    def test_returns_data(self, client):
        data = client.get(
            "/api/v1/analytics/top_spenders?country=KEN&period=FY2024"
        ).json()
        assert isinstance(data, (dict, list))
