"""Diagnostic script to inspect table structures inside KNBS PDFs."""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import requests

from etl.knbs_parser import KNBSParser
from extractors.government.knbs_extractor import KNBSExtractor


def safe_preview(value: str, limit: int = 60) -> str:
    if not value:
        return ""
    truncated = value[:limit]
    return truncated.encode("ascii", errors="replace").decode("ascii")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inspect tables extracted from a KNBS PDF"
    )
    parser.add_argument(
        "--title",
        default="2024 Economic Survey",
        help="Substring to match against document title",
    )
    parser.add_argument(
        "--type",
        dest="doc_type",
        default=None,
        help="Optional KNBS document type filter (e.g. county_statistical_abstract)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=15,
        help="Number of tables to inspect in detail",
    )
    return parser.parse_args()


# Test with one document
args = parse_args()

parser = KNBSParser()
extractor = KNBSExtractor()

# Get documents
documents = extractor.discover_documents()
print(f"\nFound {len(documents)} documents")

# Locate target document
target_doc = None
for doc in documents:
    if args.doc_type and doc.get("type") != args.doc_type:
        continue
    if args.title.lower() in doc["title"].lower():
        target_doc = doc
        break

if target_doc:
    print(f"\nAnalyzing: {target_doc['title']}")

    # Download PDF
    print(f"Downloading PDF...")
    response = requests.get(target_doc["url"], timeout=120, verify=False)
    pdf_content = response.content
    print(f"Downloaded {len(pdf_content)} bytes")

    # Extract tables
    print("\nExtracting tables...")
    tables = parser._extract_tables_from_pdf(pdf_content)
    print(f"Found {len(tables)} tables")

    # Analyze first N tables in detail (most data tables appear early)
    for i, table in enumerate(tables[: args.limit]):
        print(f"\n{'='*80}")
        print(f"TABLE {i+1}:")
        print(f"{'='*80}")

        if not table:
            print("  Empty table")
            continue

        print(f"  Total rows: {len(table)}")
        print(f"  Total columns: {len(table[0]) if table else 0}")

        # Show header row
        header_row = table[0]
        header_preview = [
            safe_preview(str(cell)) if cell else "" for cell in header_row
        ]
        print(f"  Header preview: {header_preview}")

        # Show first 3 rows
        for row_idx, row in enumerate(table[:3]):
            print(f"\n  Row {row_idx + 1}:")
            for col_idx, cell in enumerate(row[:10]):  # First 10 columns
                if cell:
                    print(f"    Col {col_idx + 1}: {safe_preview(str(cell), 80)}")

        # Highlight first rows that contain numeric values
        numeric_rows = []
        for row_idx, row in enumerate(table):
            if any(re.search(r"\d", str(cell)) for cell in row if cell):
                numeric_rows.append((row_idx, row))
            if len(numeric_rows) >= 5:
                break

        if numeric_rows:
            print("\n  Numeric rows preview:")
            for row_idx, row in numeric_rows:
                preview = [
                    safe_preview(str(cell), 60) if cell else "" for cell in row[:10]
                ]
                print(f"    Row {row_idx + 1}: {preview}")

        # Check for keywords in entire table
        all_cells = []
        for row in table:
            for cell in row:
                if cell:
                    all_cells.append(str(cell).lower())

        all_text = " ".join(all_cells[:200])  # First 200 cells for better coverage

        keywords = [
            "gdp",
            "population",
            "inflation",
            "unemployment",
            "growth",
            "poverty",
            "2023",
            "2024",
        ]
        found = {}
        for kw in keywords:
            if kw in all_text:
                found[kw] = True

        if found:
            print(f"\n  Keywords found in table: {list(found.keys())}")
        else:
            print(f"\n  No economic keywords found")

    print(f"\n{'='*80}")
    print("TABLE SUMMARY:")
    print(f"{'='*80}")

    # Count tables with economic keywords
    tables_with_gdp = []
    tables_with_population = []
    tables_with_inflation = []

    important_tables = set()

    for idx, table in enumerate(tables, start=1):
        if table:
            all_text = " ".join(
                [str(cell).lower() for row in table for cell in row if cell]
            )
            if "gdp" in all_text or "gross domestic" in all_text:
                tables_with_gdp.append(idx)
                important_tables.add(idx)
            if "population" in all_text:
                tables_with_population.append(idx)
                important_tables.add(idx)
            if "inflation" in all_text or "cpi" in all_text:
                tables_with_inflation.append(idx)
                important_tables.add(idx)

    print(f"Tables with 'GDP': {tables_with_gdp}")
    print(f"Tables with 'population': {tables_with_population}")
    print(f"Tables with 'inflation/CPI': {tables_with_inflation}")

    if important_tables:
        print(f"\n{'='*80}")
        print("DETAILS FOR KEY TABLES")
        print(f"{'='*80}")

    for idx in sorted(important_tables):
        table = tables[idx - 1]
        if not table:
            continue

        print(f"\n{'-'*80}")
        print(f"TABLE {idx} (key indicators)")
        print(f"Rows: {len(table)} | Columns: {len(table[0]) if table else 0}")

        header_preview = [safe_preview(str(cell)) if cell else "" for cell in table[0]]
        print(f"Header preview: {header_preview}")

        for row_idx, row in enumerate(table[1:6], start=2):
            row_cells = [safe_preview(str(cell)) if cell else "" for cell in row[:8]]
            print(f"Row {row_idx}: {row_cells}")

        numeric_rows = []
        for row_idx, row in enumerate(table):
            if any(re.search(r"\d", str(cell)) for cell in row if cell):
                numeric_rows.append((row_idx, row))
            if len(numeric_rows) >= 5:
                break

        if numeric_rows:
            print("Numeric rows preview:")
            for row_idx, row in numeric_rows:
                preview = [safe_preview(str(cell)) if cell else "" for cell in row[:8]]
                print(f"  Row {row_idx + 1}: {preview}")
else:
    print("Could not find 2024 Economic Survey")
