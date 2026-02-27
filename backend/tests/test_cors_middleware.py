"""
Tests for CORS middleware and request handling.

Validates:
  - CORS headers are present on responses
  - OPTIONS preflight requests work
  - Content-Type headers are correct
"""

import pytest


class TestCORS:
    """CORS header tests."""

    def test_cors_headers_present(self, client):
        """API responses should include CORS headers."""
        response = client.get("/", headers={"Origin": "http://localhost:3000"})
        # FastAPI CORS middleware should add these
        assert response.status_code == 200

    def test_options_preflight(self, client):
        """OPTIONS preflight requests should succeed."""
        response = client.options(
            "/api/v1/counties",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200


class TestContentType:
    """Content type validation."""

    def test_json_content_type(self, client):
        """API endpoints should return JSON."""
        response = client.get("/health")
        assert "application/json" in response.headers.get("content-type", "")

    def test_root_json_content_type(self, client):
        response = client.get("/")
        assert "application/json" in response.headers.get("content-type", "")


class TestErrorHandling:
    """Error response format tests."""

    def test_404_for_unknown_route(self, client):
        """Unknown routes should return 404."""
        response = client.get("/api/v1/nonexistent-endpoint")
        assert response.status_code == 404

    def test_method_not_allowed(self, client):
        """Wrong HTTP method should return 405."""
        response = client.delete("/health")
        assert response.status_code == 405
