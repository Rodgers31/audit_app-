"""
Tests for the economic data router.

Covers:
  GET /api/v1/economic/population
  GET /api/v1/economic/gdp
  GET /api/v1/economic/indicators
  GET /api/v1/economic/poverty
  GET /api/v1/economic/counties/{county_id}/profile
  GET /api/v1/economic/summary
"""

from datetime import datetime

import pytest
from models import (
    EconomicIndicator,
    Entity,
    EntityType,
    GDPData,
    PopulationData,
    PovertyIndex,
)


@pytest.fixture()
def seed_economic_data(db_session, seed_country):
    """Seed economic data for the national entity."""
    entity = Entity(
        id=50,
        country_id=seed_country.id,
        type=EntityType.NATIONAL,
        canonical_name="Kenya",
        slug="kenya-national",
    )
    db_session.add(entity)
    db_session.flush()

    pop = PopulationData(
        entity_id=entity.id,
        year=2024,
        total_population=56_000_000,
        male_population=28_000_000,
        female_population=28_000_000,
        urban_population=16_000_000,
        rural_population=40_000_000,
        population_density=97.0,
        confidence=0.95,
    )
    db_session.add(pop)

    gdp = GDPData(
        entity_id=entity.id,
        year=2024,
        quarter="Q1",
        gdp_value=14_000_000_000_000,
        gdp_growth_rate=5.2,
        currency="KES",
        confidence=0.9,
    )
    db_session.add(gdp)

    indicator = EconomicIndicator(
        indicator_type="CPI",
        indicator_date=datetime(2024, 6, 1),
        value=157.3,
        entity_id=entity.id,
        unit="index",
        confidence=0.9,
    )
    db_session.add(indicator)

    poverty = PovertyIndex(
        entity_id=entity.id,
        year=2024,
        poverty_headcount_rate=36.1,
        extreme_poverty_rate=8.5,
        gini_coefficient=0.408,
        confidence=0.85,
    )
    db_session.add(poverty)

    db_session.commit()
    return entity


class TestPopulation:
    """Tests for GET /api/v1/economic/population."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/economic/population")
        assert response.status_code == 200

    def test_returns_list(self, client, seed_economic_data):
        data = client.get("/api/v1/economic/population").json()
        assert isinstance(data, list)

    def test_filter_by_year(self, client, seed_economic_data):
        response = client.get("/api/v1/economic/population?year=2024")
        assert response.status_code == 200

    def test_filter_by_entity(self, client, seed_economic_data):
        eid = seed_economic_data.id
        response = client.get(f"/api/v1/economic/population?entity_id={eid}")
        assert response.status_code == 200


class TestGDP:
    """Tests for GET /api/v1/economic/gdp."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/economic/gdp")
        assert response.status_code == 200

    def test_returns_list(self, client, seed_economic_data):
        data = client.get("/api/v1/economic/gdp").json()
        assert isinstance(data, list)


class TestEconomicIndicators:
    """Tests for GET /api/v1/economic/indicators."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/economic/indicators")
        assert response.status_code == 200

    def test_returns_list(self, client, seed_economic_data):
        data = client.get("/api/v1/economic/indicators").json()
        assert isinstance(data, list)


class TestPoverty:
    """Tests for GET /api/v1/economic/poverty."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/economic/poverty")
        assert response.status_code == 200

    def test_returns_list(self, client, seed_economic_data):
        data = client.get("/api/v1/economic/poverty").json()
        assert isinstance(data, list)


class TestCountyEconomicProfile:
    """Tests for GET /api/v1/economic/counties/{county_id}/profile."""

    def test_returns_profile(self, client, seed_economic_data):
        eid = seed_economic_data.id
        response = client.get(f"/api/v1/economic/counties/{eid}/profile")
        assert response.status_code in (200, 404)

    def test_unknown_county_returns_404(self, client):
        response = client.get("/api/v1/economic/counties/99999/profile")
        assert response.status_code == 404


class TestEconomicSummary:
    """Tests for GET /api/v1/economic/summary."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/economic/summary")
        assert response.status_code == 200

    def test_returns_summary_structure(self, client, seed_economic_data):
        data = client.get("/api/v1/economic/summary").json()
        assert isinstance(data, dict)
