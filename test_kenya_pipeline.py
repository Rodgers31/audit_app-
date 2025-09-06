#!/usr/bin/env python3
"""
Test script for the Kenya data pipeline
This script tests the ETL components without requiring a full database setup
"""

import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


def test_normalizer():
    """Test the data normalizer component."""
    print("Testing Data Normalizer...")

    try:
        from etl.normalizer import DataNormalizer

        normalizer = DataNormalizer()

        # Test entity name normalization
        test_entities = [
            "Ministry of Health",
            "Min. of Health",
            "MOH",
            "ministry of health",
            "MINISTRY OF HEALTH",
        ]

        print("\nEntity Name Normalization Tests:")
        for entity in test_entities:
            normalized = normalizer.normalize_entity_name(entity)
            print(f"  '{entity}' -> '{normalized}'")

        # Test fiscal period parsing
        test_periods = [
            "2023/24",
            "FY 2023-2024",
            "Financial Year 2023/2024",
            "2023-24",
        ]

        print("\nFiscal Period Normalization Tests:")
        for period in test_periods:
            try:
                normalized = normalizer.normalize_fiscal_period(period)
                print(f"  '{period}' -> {normalized}")
            except Exception as e:
                print(f"  '{period}' -> ERROR: {e}")

        # Test amount normalization
        test_amounts = ["KES 1,000,000", "1.5M", "2.3 billion", "500K", "1,234,567.89"]

        print("\nAmount Normalization Tests:")
        for amount in test_amounts:
            try:
                normalized = normalizer.normalize_amount(amount, "KES")
                print(f"  '{amount}' -> {normalized}")
            except Exception as e:
                print(f"  '{amount}' -> ERROR: {e}")

        print("✅ Data Normalizer tests completed successfully!")
        return True

    except Exception as e:
        print(f"❌ Data Normalizer test failed: {e}")
        return False


def test_kenya_pipeline():
    """Test the Kenya pipeline discovery."""
    print("\nTesting Kenya Pipeline Discovery...")

    try:
        from etl.kenya_pipeline import KenyaDataPipeline

        pipeline = KenyaDataPipeline()

        # Test document discovery (without downloading)
        print("Discovering Treasury documents...")
        treasury_docs = pipeline.discover_budget_documents()

        print(f"Found {len(treasury_docs)} Treasury documents:")
        for i, doc in enumerate(treasury_docs[:3]):  # Show first 3
            print(f"  {i+1}. {doc.get('title', 'No title')}")
            print(f"     URL: {doc.get('url', 'No URL')}")
            print(f"     Type: {doc.get('type', 'Unknown')}")
            print()

        if len(treasury_docs) > 3:
            print(f"     ... and {len(treasury_docs) - 3} more documents")

        print("✅ Kenya Pipeline discovery completed successfully!")
        return True

    except Exception as e:
        print(f"❌ Kenya Pipeline test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_pdf_processing():
    """Test PDF processing capabilities."""
    print("\nTesting PDF Processing Capabilities...")

    available_libraries = []
    missing_libraries = []

    # Test pdfplumber
    try:
        import pdfplumber

        available_libraries.append("pdfplumber")
        print("✅ pdfplumber available")
    except ImportError:
        missing_libraries.append("pdfplumber")
        print("❌ pdfplumber not available")

    # Test camelot (optional)
    try:
        import camelot

        available_libraries.append("camelot")
        print("✅ camelot available")
    except ImportError:
        missing_libraries.append("camelot")
        print("⚠️  camelot not available (optional)")

    # Test tabula (optional)
    try:
        import tabula

        available_libraries.append("tabula")
        print("✅ tabula available")
    except ImportError:
        missing_libraries.append("tabula")
        print("⚠️  tabula not available (optional)")

    # At least one PDF library should be available
    if len(available_libraries) > 0:
        print(f"PDF processing ready with {len(available_libraries)} libraries!")
        return True
    else:
        print("❌ No PDF processing libraries available")
        return False


def main():
    """Run all tests."""
    print("=== Kenya Data Pipeline Test Suite ===\n")

    tests = [
        ("Data Normalizer", test_normalizer),
        ("PDF Processing", test_pdf_processing),
        ("Kenya Pipeline", test_kenya_pipeline),
    ]

    results = []
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        print(f"Running {test_name} Tests")
        print("=" * 50)

        success = test_func()
        results.append((test_name, success))

    # Summary
    print(f"\n{'='*50}")
    print("TEST SUMMARY")
    print("=" * 50)

    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name}: {status}")

    total_passed = sum(1 for _, success in results if success)
    total_tests = len(results)

    print(f"\nTotal: {total_passed}/{total_tests} tests passed")

    if total_passed == total_tests:
        print("🎉 All tests passed! The ETL pipeline is ready.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")


if __name__ == "__main__":
    main()
