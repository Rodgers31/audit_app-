"""
Test with Quarterly GDP Report (simpler structure)
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

# Test with a Quarterly GDP Report (should be simpler)
target_doc = None
for doc in documents:
    if "Quarterly" in doc["title"] and "GDP" in doc["title"]:
        target_doc = doc
        print(f"Found: {doc['title']}")
        break

if target_doc:
    print(f"\nTesting with: {target_doc['title']}")
    print(f"URL: {target_doc['url'][:80]}...")
    print(f"Type: {target_doc['type']}, Year: {target_doc.get('year')}")

    # Parse it
    result = parser.parse_document(target_doc)

    print(f"\nResults:")
    print(f"   Population records: {len(result.get('population_data', []))}")
    print(f"   GDP records: {len(result.get('gdp_data', []))}")
    print(f"   Economic indicators: {len(result.get('economic_indicators', []))}")
    print(f"   Tables extracted: {result.get('tables_extracted', 0)}")

    # Show extracted data
    if result.get("gdp_data"):
        print(f"\nGDP data extracted:")
        for gdp in result["gdp_data"][:5]:
            print(f"   - {gdp}")

    if result.get("economic_indicators"):
        print(f"\nEconomic indicators:")
        for ind in result["economic_indicators"][:5]:
            print(f"   - {ind}")
else:
    print("Could not find Quarterly GDP Report")
