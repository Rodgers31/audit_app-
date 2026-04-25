"""Tests for the national_debt fetcher's fixture+WB-IDS overlay.

These tests mock out the HTTP client so we can verify the overlay
logic deterministically without relying on the WB API being up.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List
from unittest.mock import patch

import pytest
from seeding.config import SeedingSettings
from seeding.domains.national_debt import fetcher as nd_fetcher
from seeding.domains.national_debt import wb_ids


@pytest.fixture()
def settings(tmp_path) -> SeedingSettings:
    s = SeedingSettings(
        storage_path=tmp_path / "storage",
        cache_path=tmp_path / "cache",
        log_path=tmp_path / "logs" / "seed.log",
        retry_backoff=0.01,
        max_retries=1,
        http_cache_enabled=False,
        live_pdf_fetch_enabled=True,
    )
    s.ensure_directories()
    return s


def _baseline_payload() -> Dict[str, Any]:
    """Mimics the existing fixture shape with three lender rows we'll
    expect WB IDS to overlay onto."""
    return {
        "metadata": {"source": "fixture", "units": "kes"},
        "source_url": "file://fixture",
        "source_title": "fixture",
        "loans": [
            {
                "entity_name": "National Government",
                "entity_type": "national",
                "lender": "Multilateral (World Bank / IDA / IBRD)",
                "debt_category": "external_multilateral",
                "principal": "820000000000.00",
                "outstanding": "805000000000.00",
                "interest_rate": "1.25",
                "issue_date": "2000-01-01",
                "maturity_date": None,
                "currency": "KES",
                "notes": "fixture row",
            },
            {
                "entity_name": "National Government",
                "entity_type": "national",
                "lender": "Bilateral (China — Exim Bank / CDB)",
                "debt_category": "external_bilateral",
                "principal": "650000000000.00",
                "outstanding": "640000000000.00",
                "interest_rate": "3.00",
                "issue_date": "2014-05-01",
                "maturity_date": "2030-05-01",
                "currency": "KES",
                "notes": "fixture row (no WB IDS overlay)",
            },
            {
                "entity_name": "National Government",
                "entity_type": "national",
                "lender": "Commercial Banks (Syndicated loans)",
                "debt_category": "external_commercial",
                "principal": "200000000000.00",
                "outstanding": "195000000000.00",
                "interest_rate": "8.00",
                "issue_date": "2020-01-01",
                "maturity_date": None,
                "currency": "KES",
                "notes": "fixture row",
            },
        ],
    }


def _wb_response(value_usd: float, year: str = "2024") -> List[Any]:
    """Minimal WB API response with a single observation."""
    return [
        {"page": 1, "pages": 1, "per_page": 10, "total": 1},
        [
            {
                "indicator": {"id": "X", "value": "x"},
                "country": {"id": "KE", "value": "Kenya"},
                "countryiso3code": "KEN",
                "date": year,
                "value": value_usd,
                "unit": "",
                "obs_status": "",
                "decimal": 0,
            }
        ],
    ]


# ── wb_ids.fetch_external_debt_from_wb_ids ──


class TestWbIdsFetcher:
    def test_emits_one_row_per_curated_creditor(self, settings):
        """Happy path: every WB code returns a value → one loan per
        creditor in the curated list, with KES converted at 130/USD.
        Curated list is currently {WB combined, IMF} = 2 creditors;
        PCBK + bilateral aggregate are intentionally excluded
        (see WB_IDS_CREDITORS comments)."""

        class FakeClient:
            def get(self, url, **_kwargs):
                # Different USD totals depending on indicator so we can
                # tell them apart in assertions.
                if "MIBR" in url:
                    body = _wb_response(8_000_000_000)  # IBRD
                elif "MIDA" in url:
                    body = _wb_response(2_000_000_000)  # IDA combined into the row
                elif "DIMF" in url:
                    body = _wb_response(3_300_000_000)  # IMF
                else:
                    raise AssertionError(f"unexpected URL: {url}")

                class R:
                    def json(self_):
                        return body
                return R()

        loans = wb_ids.fetch_external_debt_from_wb_ids(FakeClient(), settings)

        assert len(loans) == 2  # WB+IDA combined + IMF
        by_lender = {l["lender"]: l for l in loans}
        # World Bank is IBRD + IDA = 10B USD → 1300B KES
        wb = by_lender["Multilateral (World Bank / IDA / IBRD)"]
        assert wb["debt_category"] == "external_multilateral"
        assert Decimal(wb["outstanding"]) == Decimal("1300000000000.00")
        assert wb["currency"] == "KES"
        # Notes record the WB IDS provenance.
        assert "MIBR" in wb["notes"] and "MIDA" in wb["notes"] and "2024" in wb["notes"]

    def test_per_creditor_failure_is_isolated(self, settings):
        """A single 502/timeout doesn't kill the whole pull — other
        creditors are still emitted."""

        class FakeClient:
            def get(self, url, **_kwargs):
                if "DIMF" in url:
                    raise RuntimeError("simulated 502")
                # All others return 1 USD so we can count them.
                class R:
                    def json(self_):
                        return _wb_response(1.0)
                return R()

        loans = wb_ids.fetch_external_debt_from_wb_ids(FakeClient(), settings)
        # IMF is missing; World Bank still comes through.
        lenders = {l["lender"] for l in loans}
        assert "Multilateral (IMF — Extended Credit & Resilience Trust)" not in lenders
        assert "Multilateral (World Bank / IDA / IBRD)" in lenders

    def test_skips_when_value_is_null(self, settings):
        """WB sometimes returns rows with value=null (suppression /
        provisional). Those creditors must be skipped, not emitted as
        zero-stock records."""

        class FakeClient:
            def get(self, url, **_kwargs):
                empty = [
                    {"page": 1, "pages": 1, "per_page": 10, "total": 1},
                    [
                        {"date": "2024", "value": None}
                    ],
                ]
                class R:
                    def json(self_):
                        return empty
                return R()

        loans = wb_ids.fetch_external_debt_from_wb_ids(FakeClient(), settings)
        assert loans == []


# ── fetcher._overlay_loans ──


class TestOverlayMerge:
    def test_overlay_replaces_baseline_by_lender_match(self):
        baseline = _baseline_payload()
        overlay = [
            {
                "entity_name": "National Government",
                "entity_type": "national",
                "lender": "Multilateral (World Bank / IDA / IBRD)",
                "debt_category": "external_multilateral",
                "principal": "999999999999.00",
                "outstanding": "888888888888.00",
                "interest_rate": None,
                "issue_date": "2024-01-01",
                "maturity_date": None,
                "currency": "KES",
                "notes": "wb_ids overlay",
            }
        ]
        merged = nd_fetcher._overlay_loans(baseline, overlay)
        loans = merged["loans"]
        # Same row count — overlay replaced, didn't append.
        assert len(loans) == 3
        wb = next(l for l in loans if "World Bank" in l["lender"])
        assert wb["outstanding"] == "888888888888.00"
        assert wb["notes"] == "wb_ids overlay"
        # Untouched fixture rows preserved unchanged.
        china = next(l for l in loans if "China" in l["lender"])
        assert china["outstanding"] == "640000000000.00"

    def test_overlay_appends_unmatched_rows(self):
        """If an overlay row has a lender the fixture doesn't carry,
        it's appended (we'd rather over-include than silently drop)."""
        baseline = _baseline_payload()
        overlay = [
            {
                "entity_name": "National Government",
                "entity_type": "national",
                "lender": "Multilateral (Brand New Lender)",
                "debt_category": "external_multilateral",
                "principal": "1.00",
                "outstanding": "1.00",
                "interest_rate": None,
                "issue_date": "2024-01-01",
                "maturity_date": None,
                "currency": "KES",
                "notes": "new",
            }
        ]
        merged = nd_fetcher._overlay_loans(baseline, overlay)
        assert len(merged["loans"]) == 4
        assert any("Brand New Lender" in l["lender"] for l in merged["loans"])

    def test_overlay_lender_match_is_whitespace_collapsed(self):
        """Cosmetic whitespace differences in the lender string
        shouldn't fork rows."""
        baseline = _baseline_payload()
        # Same lender, but extra spaces and varied case.
        overlay = [
            {
                "lender": "  multilateral  (world bank /  IDA / IBRD) ",
                "outstanding": "1.00",
                "principal": "1.00",
                "entity_name": "National Government",
                "entity_type": "national",
                "debt_category": "external_multilateral",
                "interest_rate": None,
                "issue_date": "2024-01-01",
                "maturity_date": None,
                "currency": "KES",
                "notes": "overlay",
            }
        ]
        merged = nd_fetcher._overlay_loans(baseline, overlay)
        # Replaced (still 3 loans), not appended (would be 4).
        assert len(merged["loans"]) == 3


# ── fetcher.fetch_debt_payload (integration) ──


class TestFetchDebtPayload:
    def test_falls_back_to_fixture_when_wb_returns_nothing(self, settings):
        """If WB IDS yields zero rows (whole API down), we just return
        the fixture payload unchanged."""

        with (
            patch.object(nd_fetcher, "load_json_resource", return_value=_baseline_payload()),
            patch.object(nd_fetcher, "fetch_external_debt_from_wb_ids", return_value=[]),
        ):
            payload = nd_fetcher.fetch_debt_payload(client=None, settings=settings)
        assert len(payload["loans"]) == 3
        # Marker NOT set when we couldn't overlay anything.
        assert "wb_ids_overlay_applied" not in payload.get("metadata", {})

    def test_overlay_applied_metadata_set_on_success(self, settings):
        wb_overlay = [
            {
                "entity_name": "National Government",
                "entity_type": "national",
                "lender": "Multilateral (World Bank / IDA / IBRD)",
                "debt_category": "external_multilateral",
                "principal": "1.00",
                "outstanding": "1.00",
                "interest_rate": None,
                "issue_date": "2024-01-01",
                "maturity_date": None,
                "currency": "KES",
                "notes": "wb",
            }
        ]
        with (
            patch.object(nd_fetcher, "load_json_resource", return_value=_baseline_payload()),
            patch.object(nd_fetcher, "fetch_external_debt_from_wb_ids", return_value=wb_overlay),
        ):
            payload = nd_fetcher.fetch_debt_payload(client=None, settings=settings)
        meta = payload.get("metadata", {})
        assert meta.get("wb_ids_overlay_applied") is True
        assert meta.get("wb_ids_overlay_count") == 1

    def test_skips_overlay_when_live_fetch_disabled(self, settings):
        settings.live_pdf_fetch_enabled = False
        with (
            patch.object(nd_fetcher, "load_json_resource", return_value=_baseline_payload()),
            patch.object(nd_fetcher, "fetch_external_debt_from_wb_ids") as mock_wb,
        ):
            payload = nd_fetcher.fetch_debt_payload(client=None, settings=settings)
        mock_wb.assert_not_called()
        assert "wb_ids_overlay_applied" not in payload.get("metadata", {})

    def test_continues_when_wb_raises_unexpectedly(self, settings):
        """A bug in the WB module shouldn't take down the whole
        domain — we degrade to fixture and log."""
        with (
            patch.object(nd_fetcher, "load_json_resource", return_value=_baseline_payload()),
            patch.object(
                nd_fetcher, "fetch_external_debt_from_wb_ids",
                side_effect=RuntimeError("kaboom"),
            ),
        ):
            payload = nd_fetcher.fetch_debt_payload(client=None, settings=settings)
        # Same fixture, no overlay marker.
        assert len(payload["loans"]) == 3
        assert "wb_ids_overlay_applied" not in payload.get("metadata", {})
