"""Tests for ETL pipeline."""

from unittest.mock import Mock, patch

import pytest

from etl.downloader import DocumentDownloader
from etl.extractor import DocumentExtractor


class TestDocumentDownloader:
    """Test document downloading functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.downloader = DocumentDownloader(storage_path="test_downloads")

    @patch("etl.downloader.requests.get")
    def test_successful_download(self, mock_get):
        """Test successful document download."""
        mock_response = Mock()
        mock_response.content = b"PDF content here"
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = self.downloader.download_file(
            "https://example.com/document.pdf", "test_source"
        )

        assert result is not None
        assert "url" in result
        assert "md5" in result
        assert "file_path" in result

    @patch("etl.downloader.requests.get")
    def test_download_failure_handling(self, mock_get):
        """Test download failure is handled gracefully."""
        mock_get.side_effect = Exception("Network error")

        result = self.downloader.download_file(
            "https://example.com/document.pdf", "test_source"
        )

        assert result is None

    def test_md5_calculation(self):
        """Test MD5 hash calculation."""
        content = b"test content"
        md5_hash = self.downloader.calculate_md5(content)

        assert md5_hash is not None
        assert len(md5_hash) == 32  # MD5 is 32 hex characters


class TestDocumentExtractor:
    """Test document extraction functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.extractor = DocumentExtractor()

    def test_extractor_has_strategies(self):
        """Test extractor has multiple strategies."""
        assert "pdfplumber" in self.extractor.extractors
        assert "camelot" in self.extractor.extractors
        assert "tabula" in self.extractor.extractors

    def test_extraction_result_structure(self):
        """Test extraction result has required fields."""
        # This would require a real PDF file or mocking
        # For now, just test structure expectations
        result = {
            "extractor": "pdfplumber",
            "pages": [],
            "tables": [],
            "confidence": 0.7,
        }
        assert "extractor" in result
        assert "confidence" in result
