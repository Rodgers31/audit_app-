"""
Find numeric patterns in Economic Survey text
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import requests

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

    print("Downloading and extracting...")
    response = requests.get(target_doc["url"], timeout=60, verify=False)
    full_text = parser._extract_text_from_pdf(response.content)
    print(f"Extracted {len(full_text)} characters\n")

    # Search for mentions of specific data formats
    print("Searching for economic data patterns:")
    print("=" * 80)

    # Look for GDP mentions with context
    gdp_pattern = r".{0,200}GDP.{0,300}"
    gdp_matches = re.findall(gdp_pattern, full_text, re.IGNORECASE | re.DOTALL)

    print(f"\nFound {len(gdp_matches)} GDP mentions. Showing first 5:")
    for i, match in enumerate(gdp_matches[:5]):
        # Clean up whitespace
        clean = " ".join(match.split())
        print(f"\n{i+1}. {clean[:400]}...")

    # Look for large numbers that might be GDP (in billions)
    number_pattern = r"([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?)"
    numbers = re.findall(number_pattern, full_text)

    # Convert to floats and find large ones
    large_numbers = []
    for num_str in numbers:
        try:
            val = float(num_str.replace(",", ""))
            if val > 1000:  # Likely in billions
                large_numbers.append((num_str, val))
        except:
            pass

    print(f"\n\nFound {len(large_numbers)} large numbers (> 1000). Showing first 10:")
    for num_str, val in sorted(large_numbers, key=lambda x: x[1], reverse=True)[:10]:
        # Find context
        idx = full_text.find(num_str)
        context_start = max(0, idx - 100)
        context_end = min(len(full_text), idx + 150)
        context = " ".join(full_text[context_start:context_end].split())
        print(f"\n   {num_str} (value: {val:,.0f})")
        print(f"   Context: ...{context}...")

else:
    print("Could not find 2024 Economic Survey")
