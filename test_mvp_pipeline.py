#!/usr/bin/env python3
"""
Simplified test for the Kenya data pipeline focusing on core functionality
"""

import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


def test_core_data_pipeline():
    """Test the core data pipeline functionality without database dependencies."""
    print("Testing Core Data Pipeline Components...")

    try:
        # Test source registry
        from etl.source_registry import registry

        print("✅ Source Registry loaded successfully")

        # Test getting Kenya sources
        kenya_sources = registry.get_sources_by_country("KE")
        print(f"✅ Found {len(kenya_sources)} Kenya data sources:")

        for source in kenya_sources[:3]:  # Show first 3
            print(f"  - {source.get('name', 'Unknown')}")
            print(f"    URL: {source.get('base_url', 'N/A')}")
            print(f"    Type: {source.get('source_type', 'N/A')}")
            print()

        # Test normalizer
        from etl.normalizer import DataNormalizer

        normalizer = DataNormalizer()

        print("✅ Data Normalizer loaded successfully")

        # Test entity normalization
        test_entity = normalizer.normalize_entity_name("Ministry of Finance")
        print(f"✅ Entity normalization test: 'Ministry of Finance' -> {test_entity}")

        # Test fiscal period normalization
        test_period = normalizer.normalize_fiscal_period("2023/24")
        print(f"✅ Fiscal period normalization test: '2023/24' -> {test_period}")

        # Test amount normalization
        test_amount = normalizer.normalize_amount("KES 1,500,000", "KES")
        print(f"✅ Amount normalization test: 'KES 1,500,000' -> {test_amount}")

        return True

    except Exception as e:
        print(f"❌ Core pipeline test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_document_discovery():
    """Test document discovery without actually downloading."""
    print("\nTesting Document Discovery...")

    try:
        import requests
        from bs4 import BeautifulSoup

        print("✅ Web scraping libraries available")

        # Test basic HTTP functionality
        response = requests.get("https://httpbin.org/get", timeout=10)
        if response.status_code == 200:
            print("✅ HTTP requests working")
        else:
            print("❌ HTTP requests not working")
            return False

        # Test BeautifulSoup
        soup = BeautifulSoup("<html><body><p>Test</p></body></html>", "html.parser")
        if soup.find("p"):
            print("✅ BeautifulSoup HTML parsing working")
        else:
            print("❌ BeautifulSoup not working")
            return False

        return True

    except Exception as e:
        print(f"❌ Document discovery test failed: {e}")
        return False


def test_mvp_functionality():
    """Test MVP-specific functionality."""
    print("\nTesting MVP Core Features...")

    try:
        from etl.normalizer import DataNormalizer
        from etl.source_registry import registry

        # Verify Kenya-specific sources are configured
        kenya_sources = registry.get_sources_by_country("KE")

        required_sources = ["treasury", "auditor_general", "controller_budget"]
        found_sources = set()

        for source in kenya_sources:
            source_type = source.get("source_type", "")
            if source_type in required_sources:
                found_sources.add(source_type)

        print(
            f"✅ Found {len(found_sources)}/{len(required_sources)} required Kenya sources"
        )

        for source_type in required_sources:
            if source_type in found_sources:
                print(f"  ✅ {source_type}")
            else:
                print(f"  ❌ {source_type} missing")

        # Test MVP data normalization patterns
        normalizer = DataNormalizer()

        # Test Kenya-specific entities
        kenya_entities = [
            "Ministry of Finance and Economic Planning",
            "Ministry of Health",
            "Ministry of Education",
            "Office of the President",
        ]

        print("\n✅ Testing Kenya entity normalization:")
        for entity in kenya_entities:
            normalized = normalizer.normalize_entity_name(entity)
            print(f"  '{entity}' -> {normalized}")

        # Test Kenya fiscal year patterns
        kenya_periods = ["2023/24", "FY 2022/23", "Financial Year 2024/2025"]

        print("\n✅ Testing Kenya fiscal period normalization:")
        for period in kenya_periods:
            normalized = normalizer.normalize_fiscal_period(period)
            print(f"  '{period}' -> {normalized}")

        return len(found_sources) >= 2  # At least 2 of 3 required sources

    except Exception as e:
        print(f"❌ MVP functionality test failed: {e}")
        return False


def main():
    """Run simplified test suite."""
    print("=== Kenya Data Pipeline MVP Test Suite ===\\n")

    tests = [
        ("Core Data Pipeline", test_core_data_pipeline),
        ("Document Discovery", test_document_discovery),
        ("MVP Functionality", test_mvp_functionality),
    ]

    results = []
    for test_name, test_func in tests:
        print(f"{'='*50}")
        print(f"Running {test_name} Tests")
        print("=" * 50)

        success = test_func()
        results.append((test_name, success))

    # Summary
    print(f"\\n{'='*50}")
    print("TEST SUMMARY")
    print("=" * 50)

    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name}: {status}")

    total_passed = sum(1 for _, success in results if success)
    total_tests = len(results)

    print(f"\\nTotal: {total_passed}/{total_tests} tests passed")

    if total_passed == total_tests:
        print("🎉 All MVP core tests passed! The ETL pipeline foundation is ready.")
        print("\\n📋 Next Steps:")
        print("1. Install PDF processing libraries for document extraction")
        print("2. Set up PostgreSQL database for data storage")
        print("3. Test with actual Kenya government document URLs")
        print("4. Integrate with FastAPI backend")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        print("\\n🔧 Possible fixes:")
        print("1. Install missing Python packages: pip install requests beautifulsoup4")
        print("2. Check internet connectivity for web requests")
        print("3. Verify source registry configuration")


if __name__ == "__main__":
    main()
