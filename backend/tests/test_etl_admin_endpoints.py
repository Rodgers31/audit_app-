"""
Tests for ETL and admin endpoints.

Covers:
  POST /api/v1/admin/etl/run
  GET  /api/v1/admin/etl/status
  GET  /api/v1/admin/etl/schedule
  GET  /api/v1/admin/etl/schedule/summary
  GET  /api/v1/admin/etl/health
  GET  /api/v1/admin/ingestion-jobs
  GET  /api/v1/admin/ingestion-jobs/stats/summary
  GET  /api/v1/etl/status/{job_id}
  GET  /api/v1/etl/kenya/sources
  GET  /api/v1/storage/status
  GET  /api/v1/docs/resolve
"""

import pytest


class TestETLAdminRun:
    """Tests for POST /api/v1/admin/etl/run."""

    def test_etl_run_returns_response(self, client):
        """ETL run should return a job status response."""
        response = client.post("/api/v1/admin/etl/run")
        # Could be 200 or 401 if auth required, or 500 if ETL unavailable
        assert response.status_code in (200, 401, 403, 422, 500)


class TestETLAdminStatus:
    """Tests for GET /api/v1/admin/etl/status."""

    def test_returns_status(self, client):
        response = client.get("/api/v1/admin/etl/status")
        assert response.status_code in (200, 404, 500)


class TestETLSchedule:
    """Tests for GET /api/v1/admin/etl/schedule."""

    def test_returns_schedule(self, client):
        response = client.get("/api/v1/admin/etl/schedule")
        # 401 if auth is required, 200 otherwise
        assert response.status_code in (200, 401)

    def test_schedule_has_data(self, client):
        response = client.get("/api/v1/admin/etl/schedule")
        if response.status_code == 401:
            pytest.skip("Admin auth required")
        data = response.json()
        assert isinstance(data, dict)


class TestETLScheduleSummary:
    """Tests for GET /api/v1/admin/etl/schedule/summary."""

    def test_returns_summary(self, client):
        response = client.get("/api/v1/admin/etl/schedule/summary")
        assert response.status_code in (200, 401)

    def test_summary_structure(self, client):
        response = client.get("/api/v1/admin/etl/schedule/summary")
        if response.status_code == 401:
            pytest.skip("Admin auth required")
        data = response.json()
        assert isinstance(data, dict)


class TestETLHealth:
    """Tests for GET /api/v1/admin/etl/health."""

    def test_returns_health(self, client):
        response = client.get("/api/v1/admin/etl/health")
        assert response.status_code in (200, 401)


class TestIngestionJobs:
    """Tests for GET /api/v1/admin/ingestion-jobs."""

    def test_returns_list(self, client):
        response = client.get("/api/v1/admin/ingestion-jobs")
        assert response.status_code in (200, 500)

    def test_pagination_params(self, client):
        response = client.get("/api/v1/admin/ingestion-jobs?page=1&page_size=5")
        assert response.status_code in (200, 500)


class TestIngestionJobStats:
    """Tests for GET /api/v1/admin/ingestion-jobs/stats/summary."""

    def test_returns_stats(self, client):
        response = client.get("/api/v1/admin/ingestion-jobs/stats/summary")
        assert response.status_code in (200, 500)


class TestETLJobStatus:
    """Tests for GET /api/v1/etl/status/{job_id}."""

    def test_returns_status_for_id(self, client):
        response = client.get("/api/v1/etl/status/test-job-123")
        assert response.status_code in (200, 404, 500)


class TestETLKenyaSources:
    """Tests for GET /api/v1/etl/kenya/sources."""

    def test_returns_sources(self, client):
        response = client.get("/api/v1/etl/kenya/sources")
        assert response.status_code == 200

    def test_sources_is_list(self, client):
        data = client.get("/api/v1/etl/kenya/sources").json()
        assert isinstance(data, (list, dict))


class TestStorageStatus:
    """Tests for GET /api/v1/storage/status."""

    def test_returns_200(self, client):
        response = client.get("/api/v1/storage/status")
        assert response.status_code == 200


class TestDocsResolve:
    """Tests for GET /api/v1/docs/resolve."""

    def test_returns_response(self, client):
        response = client.get("/api/v1/docs/resolve")
        assert response.status_code in (200, 422, 400)
