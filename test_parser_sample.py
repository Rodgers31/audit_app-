"""
Quick test to examine extracted text from KNBS documents
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from etl.knbs_parser import KNBSParser
from extractors.government.knbs_extractor import KNBSExtractor

# Test with one document
parser = KNBSParser()
extractor = KNBSExtractor()

# Get documents
documents = extractor.discover_documents()
print(f"\nFound {len(documents)} documents")

# Test with the 2024 Economic Survey
target_doc = None
for doc in documents:
    if "2024 Economic Survey" in doc["title"]:
        target_doc = doc
        break

if target_doc:
    print(f"\nTesting with: {target_doc['title']}")
    print(f"   URL: {target_doc['url'][:80]}...")
    print(f"   Type: {target_doc['type']}, Year: {target_doc.get('year')}")

    # Parse it
    result = parser.parse_document(target_doc)

    # Also get the full text for keyword search
    import os
    import tempfile

    # Download the PDF
    import requests

    response = requests.get(target_doc["url"], timeout=60)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name

    # Extract full text
    from etl.knbs_parser import KNBSParser

    parser_instance = KNBSParser()
    full_text = parser_instance._extract_text_from_pdf(response.content)

    # Search for keywords
    keywords = [
        "GDP",
        "population",
        "inflation",
        "unemployment",
        "trillion",
        "billion",
        "million people",
    ]
    print("\nKeyword search in full text:")
    for keyword in keywords:
        count = full_text.lower().count(keyword.lower())
        print(f"   '{keyword}': {count} occurrences")
        if count > 0:
            # Show first occurrence context
            idx = full_text.lower().find(keyword.lower())
            context_start = max(0, idx - 100)
            context_end = min(len(full_text), idx + 200)
            print(f"      Context: ...{full_text[context_start:context_end]}...")
            break

    os.unlink(tmp_path)

    print(f"\nResults:")
    print(f"   Population records: {len(result.get('population_data', []))}")
    print(f"   GDP records: {len(result.get('gdp_data', []))}")
    print(f"   Economic indicators: {len(result.get('economic_indicators', []))}")

    # Show raw text sample
    if result.get("raw_text_sample"):
        print(f"\nRaw text sample (first 5000 chars):")
        print("=" * 80)
        print(result["raw_text_sample"][:5000])
        print("=" * 80)

    # Show what was extracted
    if result.get("population_data"):
        print(f"\nPopulation data:")
        for p in result["population_data"]:
            print(f"   - {p}")

    if result.get("gdp_data"):
        print(f"\nGDP data:")
        for g in result["gdp_data"]:
            print(f"   - {g}")

    if result.get("economic_indicators"):
        print(f"\nEconomic indicators:")
        for i in result["economic_indicators"]:
            print(f"   - {i}")
        for i in result["economic_indicators"]:
            print(f"   - {i}")
else:
    print("Could not find 2024 Economic Survey")
