"""Unit tests for the small helper functions in ``seeding.utils``.

Focused on slugify_entity because it's the regression point behind the
recurring "Unknown entity slug 'murang'a-county'" warnings: a naive
``name.lower().replace(" ", "-")`` left the apostrophe in place and
didn't match the DB's canonical ``muranga-county`` slug format.
"""

from __future__ import annotations

import pytest

from seeding.utils import canonicalize_slug, slugify_entity


class TestSlugifyEntity:
    """Every character that isn't [a-z0-9] must collapse to a hyphen."""

    def test_strips_apostrophe_from_muranga(self):
        # Regression: the exact prod warning line was "Unknown entity
        # slug 'murang'a-county'". Canonical DB slug is "muranga-county".
        assert slugify_entity("Murang'a") == "muranga-county"

    def test_strips_apostrophe_regardless_of_position(self):
        # Apostrophe is stripped, not replaced with a hyphen — so
        # "O'Brien" → "obrien", not "o-brien".
        assert slugify_entity("O'Brien") == "obrien-county"

    def test_strips_unicode_right_single_quote(self):
        # Some upstream JSON uses "Murang\u2019a" (curly apostrophe)
        # instead of the ASCII form — both must normalise identically.
        assert slugify_entity("Murang\u2019a") == "muranga-county"

    def test_keeps_simple_name_untouched(self):
        assert slugify_entity("Nairobi") == "nairobi-county"

    def test_collapses_multi_word_with_space(self):
        assert slugify_entity("Taita Taveta") == "taita-taveta-county"

    def test_collapses_repeated_punctuation_to_single_hyphen(self):
        # "Homa-Bay" and "Homa — Bay" must both produce "homa-bay-county".
        assert slugify_entity("Homa-Bay") == "homa-bay-county"
        assert slugify_entity("Homa — Bay") == "homa-bay-county"

    def test_trims_leading_trailing_hyphens(self):
        assert slugify_entity(" -Nakuru- ") == "nakuru-county"

    def test_idempotent_when_input_already_has_suffix(self):
        # Don't append "-county" twice.
        assert slugify_entity("Muranga County") == "muranga-county"
        assert slugify_entity("muranga-county") == "muranga-county"

    def test_county_suffix_opt_out(self):
        # National Government is not a county; the caller passes
        # county_suffix=False to keep the bare slug.
        assert (
            slugify_entity("National Government", county_suffix=False)
            == "national-government"
        )

    def test_empty_input_returns_empty(self):
        assert slugify_entity("") == ""
        assert slugify_entity("   ") == ""


class TestCanonicalizeSlug:
    """canonicalize_slug normalises an EXISTING slug without touching
    the -county suffix — used at the writer's lookup boundary so
    fixture/JSON-derived slugs match the DB's canonical form even when
    they carry apostrophes or stray whitespace."""

    def test_strips_apostrophe_in_existing_slug(self):
        # The exact prod regression: fixture had "murang'a-county",
        # DB has "muranga-county", lookup failed and 6 audits were
        # silently dropped each nightly run.
        assert canonicalize_slug("murang'a-county") == "muranga-county"

    def test_does_not_add_county_suffix(self):
        # Unlike slugify_entity, this helper must NEVER append -county
        # because callers may pass national-level slugs.
        assert canonicalize_slug("national-government") == "national-government"

    def test_idempotent(self):
        canonical = "muranga-county"
        assert canonicalize_slug(canonical) == canonical
        assert canonicalize_slug(canonicalize_slug(canonical)) == canonical

    def test_handles_uppercase_and_spaces(self):
        assert canonicalize_slug("Muranga County") == "muranga-county"

    def test_strips_unicode_apostrophe(self):
        assert canonicalize_slug("murang\u2019a-county") == "muranga-county"

    def test_empty_returns_empty(self):
        assert canonicalize_slug("") == ""
        assert canonicalize_slug("   ") == ""
