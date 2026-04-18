#!/usr/bin/env python3
"""
Live DSpace endpoint validation script.

Run this on a machine with network access to libraryir.parliament.go.ke
to verify the Parliament DSpace 7 REST API assumptions.

Usage:
    python -m etl.validate_dspace_live
    python etl/validate_dspace_live.py --max-items 10 --verbose

This is a READ-ONLY diagnostic — it does not write to any database.
"""

import argparse
import json
import logging
import sys
import time

logger = logging.getLogger(__name__)

try:
    from .parliament_dspace_client import (
        AUDITOR_GENERAL_COMMUNITY,
        AUDITOR_GENERAL_SUBCOMMUNITY,
        NATIONAL_ASSEMBLY_COMMUNITY,
        SENATE_COMMUNITY,
        COLLECTION_CONSTITUENCIES_AG,
        BASE_URL,
        BitstreamInfo,
        ParliamentDSpaceClient,
    )
except ImportError:
    from parliament_dspace_client import (
        AUDITOR_GENERAL_COMMUNITY,
        AUDITOR_GENERAL_SUBCOMMUNITY,
        NATIONAL_ASSEMBLY_COMMUNITY,
        SENATE_COMMUNITY,
        COLLECTION_CONSTITUENCIES_AG,
        BASE_URL,
        BitstreamInfo,
        ParliamentDSpaceClient,
    )

try:
    from .report_classifier import ReportClassifier
except ImportError:
    from report_classifier import ReportClassifier

try:
    from .entity_resolver import EntityResolver
except ImportError:
    from entity_resolver import EntityResolver


def validate(max_items: int = 10, verbose: bool = False) -> dict:
    """Run live validation against the DSpace endpoint.

    Returns a findings dict with pass/fail for each check.
    """
    findings = {
        "endpoint": BASE_URL,
        "community_uuid": AUDITOR_GENERAL_COMMUNITY,
        "checks": {},
        "items_sampled": [],
        "corrections_needed": [],
    }

    client = ParliamentDSpaceClient(
        page_size=5,
        request_delay=0.8,  # gentle
        max_items=max_items,
    )
    classifier = ReportClassifier()
    resolver = EntityResolver()

    # ── 1. Root API reachability ──────────────────────────────────────────
    print("1. Testing root API endpoint...")
    try:
        data = client._get("")
        findings["checks"]["root_reachable"] = True
        findings["api_type"] = data.get("type", "unknown")
        print(f"   PASS — root responds, type={findings['api_type']}")
    except Exception as e:
        findings["checks"]["root_reachable"] = False
        findings["root_error"] = str(e)
        print(f"   FAIL — {e}")
        # If root is unreachable, we can't proceed
        if "ProxyError" in str(e) or "ConnectionError" in str(e):
            print("\n   Cannot reach endpoint. Run this on a machine with direct network access.")
            return findings

    # ── 2. Community fetch ─────────────────────────────────────────────
    print("2. Fetching communities...")
    community_uuid_to_use = None
    for label, cuuid in [
        ("AG Sub-community", AUDITOR_GENERAL_SUBCOMMUNITY),
        ("National Assembly", NATIONAL_ASSEMBLY_COMMUNITY),
        ("Senate (was legacy AG)", SENATE_COMMUNITY),
    ]:
        try:
            community = client.get_community(cuuid)
            cname = community.get("name", "?")
            print(f"   [{label}] FOUND — name={cname} uuid={cuuid}")
            findings[f"community_{label}"] = {"name": cname, "uuid": cuuid}
            if not community_uuid_to_use:
                community_uuid_to_use = cuuid
        except Exception as e:
            print(f"   [{label}] NOT FOUND — {e}")
            if label == "AG Sub-community":
                findings["corrections_needed"].append(
                    f"AG sub-community UUID {cuuid} not found — update AUDITOR_GENERAL_SUBCOMMUNITY"
                )

    if community_uuid_to_use:
        findings["checks"]["community_exists"] = True
        findings["active_community_uuid"] = community_uuid_to_use
    else:
        findings["checks"]["community_exists"] = False
        findings["corrections_needed"].append("Neither community UUID works — need manual discovery")
        return findings

    # ── 2b. Sub-community discovery ──────────────────────────────────────
    print("2b. Listing sub-communities...")
    try:
        subcommunities = client.list_subcommunities(community_uuid_to_use)
        findings["subcommunity_count"] = len(subcommunities)
        findings["subcommunities"] = [
            {"name": sc.get("name", "?"), "uuid": sc.get("uuid", "?")}
            for sc in subcommunities[:20]
        ]
        print(f"   Found {len(subcommunities)} sub-communities:")
        for sc in subcommunities[:15]:
            print(f"     - {sc.get('name', '?')[:70]} (uuid={sc.get('uuid', '?')[:12]}...)")
    except Exception as e:
        print(f"   Sub-community listing failed (may not be supported): {e}")

    # ── 3. Collection listing ─────────────────────────────────────────────
    print("3. Listing collections...")
    try:
        collections = client.list_collections(community_uuid_to_use)
        findings["checks"]["collections_listed"] = True
        findings["collection_count"] = len(collections)
        findings["collections"] = [
            {"name": c.get("name", "?"), "uuid": c.get("uuid", "?")}
            for c in collections[:20]
        ]
        print(f"   PASS — {len(collections)} collections found")
        for c in collections[:10]:
            print(f"     - {c.get('name', '?')[:70]}")
    except Exception as e:
        findings["checks"]["collections_listed"] = False
        print(f"   FAIL — {e}")

    # ── 4. Discovery / search ─────────────────────────────────────────────
    print(f"4. Discovering items (max {max_items})...")
    items = []
    try:
        for item in client.discover_items(community_uuid=community_uuid_to_use):
            items.append(item)
            if len(items) >= max_items:
                break
        findings["checks"]["discovery_works"] = True
        findings["items_discovered"] = len(items)
        print(f"   PASS — {len(items)} items discovered")
    except Exception as e:
        findings["checks"]["discovery_works"] = False
        findings["corrections_needed"].append(f"Discovery failed: {e}")
        print(f"   FAIL — {e}")
        return findings

    if not items:
        print("   WARNING — no items found, cannot continue checks")
        return findings

    # ── 5. Metadata structure ─────────────────────────────────────────────
    print("5. Checking metadata structure...")
    sample = items[0]
    md_keys = list(sample.metadata.keys()) if sample.metadata else []
    findings["metadata_keys_sample"] = md_keys
    has_title = "dc.title" in md_keys
    has_date = "dc.date.issued" in md_keys
    findings["checks"]["metadata_has_title"] = has_title
    findings["checks"]["metadata_has_date"] = has_date
    print(f"   dc.title present: {has_title}")
    print(f"   dc.date.issued present: {has_date}")
    print(f"   Metadata keys: {md_keys[:15]}")

    # Check metadata value format (should be list of {value: str} dicts)
    title_raw = sample.metadata.get("dc.title", [])
    if title_raw:
        first = title_raw[0] if isinstance(title_raw, list) else title_raw
        is_dict = isinstance(first, dict)
        findings["checks"]["metadata_value_is_dict"] = is_dict
        if is_dict:
            print(f"   Metadata value format: dict with keys {list(first.keys())}")
        else:
            print(f"   Metadata value format: {type(first).__name__} — may need client update!")
            findings["corrections_needed"].append(
                f"Metadata values are {type(first).__name__}, not dict. Update _meta_first/_meta_list."
            )

    # ── 6. Bitstream resolution ───────────────────────────────────────────
    print("6. Resolving bitstreams for first item...")
    try:
        bitstreams = client.get_bitstreams(sample.uuid)
        findings["checks"]["bitstreams_resolved"] = len(bitstreams) > 0
        findings["bitstream_count_sample"] = len(bitstreams)
        print(f"   PASS — {len(bitstreams)} bitstreams found")
        for bs in bitstreams:
            print(
                f"     - {bs.name} ({bs.mime_type}, {bs.size_bytes} bytes, "
                f"checksum={bs.checksum_algorithm}:{bs.checksum_value[:16]}...)"
            )
        if bitstreams:
            # Check if checksum is present
            has_checksum = bool(bitstreams[0].checksum_value)
            findings["checks"]["checksum_available"] = has_checksum
            if not has_checksum:
                findings["corrections_needed"].append(
                    "Bitstream checksum not returned — may need different field path"
                )
    except Exception as e:
        findings["checks"]["bitstreams_resolved"] = False
        findings["corrections_needed"].append(f"Bitstream resolution failed: {e}")
        print(f"   FAIL — {e}")

    # ── 7. Classifier + resolver on real titles ───────────────────────────
    print("7. Running classifier + resolver on discovered items...")
    for item in items[:max_items]:
        cls = classifier.classify(title=item.title, subjects=item.subjects)
        res = resolver.resolve(item.title)
        sample_entry = {
            "uuid": item.uuid[:12],
            "title": item.title[:100],
            "doc_type": cls.doc_type,
            "cls_confidence": cls.confidence,
            "entity_name": res.entity_name[:60],
            "entity_type": res.entity_type,
            "fiscal_years": res.fiscal_years,
            "res_confidence": res.confidence,
        }
        findings["items_sampled"].append(sample_entry)
        if verbose:
            print(
                f"   [{cls.doc_type:20s}] conf={cls.confidence:.2f} "
                f"entity={res.entity_name[:40]:40s} fy={res.fiscal_years}  "
                f"title={item.title[:60]}"
            )

    # Count classifications
    type_counts = {}
    for s in findings["items_sampled"]:
        t = s["doc_type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    findings["classification_distribution"] = type_counts
    print(f"   Classification distribution: {type_counts}")

    # Count low-confidence
    low_conf = sum(1 for s in findings["items_sampled"] if s["cls_confidence"] < 0.5)
    findings["low_confidence_count"] = low_conf
    if low_conf > 0:
        print(f"   WARNING — {low_conf} items with classification confidence < 0.5")

    # ── 8. Green Book search ──────────────────────────────────────────────
    print("8. Searching for Green Books specifically...")
    try:
        gb_items = []
        for item in client.discover_items(
            community_uuid=AUDITOR_GENERAL_COMMUNITY,
            query="Summary Audit County",
        ):
            gb_items.append(item)
            if len(gb_items) >= 5:
                break
        findings["checks"]["green_book_search"] = len(gb_items) > 0
        findings["green_book_count"] = len(gb_items)
        print(f"   Found {len(gb_items)} green-book-like items")
        for g in gb_items:
            print(f"     - {g.title[:80]}")
    except Exception as e:
        findings["checks"]["green_book_search"] = False
        print(f"   FAIL — {e}")

    # ── Summary ───────────────────────────────────────────────────────────
    print("\n=== VALIDATION SUMMARY ===")
    all_pass = all(findings["checks"].values())
    findings["overall_pass"] = all_pass
    for check, result in findings["checks"].items():
        status = "PASS" if result else "FAIL"
        print(f"  [{status}] {check}")

    if findings["corrections_needed"]:
        print("\nCorrections needed:")
        for c in findings["corrections_needed"]:
            print(f"  ! {c}")
    else:
        print("\nNo corrections needed — client matches endpoint.")

    return findings


def main():
    parser = argparse.ArgumentParser(description="DSpace Live Endpoint Validator")
    parser.add_argument("--max-items", type=int, default=10)
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--json-output", type=str, help="Write findings to JSON file")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    findings = validate(max_items=args.max_items, verbose=args.verbose)

    if args.json_output:
        with open(args.json_output, "w") as f:
            json.dump(findings, f, indent=2)
        print(f"\nFindings written to {args.json_output}")


if __name__ == "__main__":
    main()
