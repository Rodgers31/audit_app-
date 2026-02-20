"""
Find where economic data appears in the Economic Survey
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

# Test with the 2024 Economic Survey
target_doc = None
for doc in documents:
    if "2024 Economic Survey" in doc["title"]:
        target_doc = doc
        break

if target_doc:
    print(f"Testing with: {target_doc['title']}\n")

    # We need to get the FULL text, not just the sample
    # Let's directly call the internal methods
    import requests

    print("Downloading PDF...")
    response = requests.get(target_doc["url"], timeout=60, verify=False)
    print(f"Downloaded {len(response.content)} bytes\n")

    print("Extracting text...")
    full_text = parser._extract_text_from_pdf(response.content)
    print(f"Extracted {len(full_text)} characters\n")

    # Search for keywords in slices
    keywords = ["GDP", "population", "inflation", "growth rate", "trillion", "billion"]
    slice_size = 10000

    print("Searching for first occurrence of each keyword:")
    print("=" * 80)
    for keyword in keywords:
        idx = full_text.lower().find(keyword.lower())
        if idx >= 0:
            # Show context
            context_start = max(0, idx - 200)
            context_end = min(len(full_text), idx + 300)
            context = full_text[context_start:context_end]

            print(f"\n'{keyword}' found at position {idx}:")
            print(f"Context: ...{context}...")
            print("-" * 80)
        else:
            print(f"\n'{keyword}' NOT FOUND in {len(full_text)} characters")

else:
    print("Could not find 2024 Economic Survey")
