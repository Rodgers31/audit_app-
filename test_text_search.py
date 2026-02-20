"""
Search for keywords in extracted text from Economic Survey
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

    # Parse it
    result = parser.parse_document(target_doc)

    # Get the raw text from the internal parser method (it's already downloaded)
    # We can access the full text through result
    print(f"\nResults:")
    print(f"   Population records: {len(result.get('population_data', []))}")
    print(f"   GDP records: {len(result.get('gdp_data', []))}")
    print(f"   Economic indicators: {len(result.get('economic_indicators', []))}")

    # Show sample
    sample = result.get("raw_text_sample", "")
    print(f"\nText sample length: {len(sample)} chars")
    print(f"First 3000 chars:")
    print("=" * 80)
    print(sample[:3000])
    print("=" * 80)

    # Search for keywords
    keywords = [
        "GDP",
        "population",
        "inflation",
        "unemployment",
        "trillion",
        "billion",
        "million people",
        "growth",
    ]
    print("\nKeyword search in sample text:")
    for keyword in keywords:
        count = sample.lower().count(keyword.lower())
        print(f"   '{keyword}': {count} occurrences")

    # Try to find economic data in the text
    print("\nSearching for numeric patterns:")
    import re

    # GDP patterns
    gdp_patterns = [
        r"gdp[:\s]+(?:ksh\.?|kshs?\.?)?[:\s]*([0-9]+\.?[0-9]*)\s*(?:trillion|billion)",
        r"gross\s+domestic\s+product[:\s]+(?:ksh\.?)?[:\s]*([0-9]+\.?[0-9]*)\s*(?:trillion|billion)",
        r"([0-9]+\.?[0-9]*)\s*(?:trillion|billion)\s+(?:ksh|shillings)",
    ]

    for pattern in gdp_patterns:
        matches = re.findall(pattern, sample.lower())
        if matches:
            print(f"   GDP pattern '{pattern[:50]}...' found: {matches}")

    # Population patterns
    pop_patterns = [
        r"population[:\s]+([0-9,]+)",
        r"([0-9]+\.?[0-9]*)\s*million\s+(?:people|population)",
    ]

    for pattern in pop_patterns:
        matches = re.findall(pattern, sample.lower())
        if matches:
            print(f"   Population pattern '{pattern[:50]}...' found: {matches}")
else:
    print("Could not find 2024 Economic Survey")
