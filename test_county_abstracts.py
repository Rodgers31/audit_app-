"""Quick harness to evaluate county statistical abstract extraction."""

from __future__ import annotations

from pprint import pprint

from etl.knbs_parser import KNBSParser
from extractors.government.knbs_extractor import KNBSExtractor


def main() -> None:
    parser = KNBSParser()
    extractor = KNBSExtractor()

    documents = extractor.discover_documents()
    county_docs = [
        doc for doc in documents if doc.get("type") == "county_statistical_abstract"
    ]

    print(f"Discovered {len(documents)} total documents")
    print(f"County statistical abstracts available: {len(county_docs)}")

    sample_docs = county_docs[:5]
    for idx, doc in enumerate(sample_docs, start=1):
        print("\n" + "=" * 80)
        print(f"[{idx}] {doc['title']}")
        print(f"    URL: {doc['url']}")
        print(f"    County: {doc.get('county')} | Year: {doc.get('year')}")

        result = parser.parse_document(doc)

        print(f"    Tables extracted: {result.get('tables_extracted', 0)}")
        print(f"    Population rows: {len(result.get('population_data', []))}")
        print(f"    GDP rows: {len(result.get('gdp_data', []))}")
        print(f"    Indicators: {len(result.get('economic_indicators', []))}")

        if result.get("population_data"):
            print("    Sample population entry:")
            pprint(result["population_data"][0])

        if result.get("gdp_data"):
            print("    Sample GDP entry:")
            pprint(result["gdp_data"][0])

        if result.get("economic_indicators"):
            print("    Sample economic indicator:")
            pprint(result["economic_indicators"][0])


if __name__ == "__main__":
    main()
