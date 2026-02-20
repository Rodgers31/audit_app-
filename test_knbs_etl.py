"""
Test script to run KNBS ETL pipeline directly
Bypasses smart scheduler for testing purposes
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables
from dotenv import load_dotenv

load_dotenv("backend/.env")

# Import pipeline components
from etl.knbs_parser import KNBSParser
from extractors.government.knbs_extractor import KNBSExtractor


async def test_knbs_pipeline():
    """Run KNBS ETL pipeline for testing"""

    logger.info("=" * 80)
    logger.info("KNBS ETL Pipeline Test")
    logger.info("=" * 80)

    results = {
        "start_time": datetime.now().isoformat(),
        "documents_discovered": 0,
        "documents_downloaded": 0,
        "documents_parsed": 0,
        "records_loaded": 0,
        "errors": [],
    }

    try:
        # Step 1: Extract - Discover KNBS documents
        logger.info("\n[Step 1/3] Discovering KNBS documents...")
        extractor = KNBSExtractor()
        documents = extractor.discover_documents()

        results["documents_discovered"] = len(documents)
        logger.info(f"✅ Discovered {len(documents)} KNBS documents")

        if documents:
            logger.info("\nSample documents:")
            for i, doc in enumerate(documents[:5], 1):
                logger.info(f"  {i}. {doc['title']}")
                logger.info(
                    f"     Type: {doc.get('type', 'unknown')}, Year: {doc.get('year', 'N/A')}"
                )
                logger.info(f"     URL: {doc['url'][:80]}...")

        # Step 2: Parse - Extract data from documents
        logger.info(f"\n[Step 2/3] Parsing {len(documents)} documents...")
        parser = KNBSParser()

        all_parsed_data = []  # Store all parsed results

        # Limit to first 10 documents for testing (full run can take hours)
        documents_to_process = documents[:10] if len(documents) > 10 else documents
        logger.info(
            f"Processing {len(documents_to_process)} of {len(documents)} documents (limited for testing)"
        )

        for i, doc in enumerate(documents_to_process, 1):
            try:
                logger.info(
                    f"\n[{i}/{len(documents_to_process)}] Parsing: {doc['title'][:60]}..."
                )
                logger.info(
                    f"  Type: {doc.get('type', 'unknown')}, Year: {doc.get('year', 'N/A')}"
                )

                # Parse document using parser's main entry point
                # Parser handles downloading and parsing based on document type
                parsed_data = parser.parse_document(doc)

                if parsed_data:
                    results["documents_parsed"] += 1
                    all_parsed_data.append(parsed_data)

                    # Log what was extracted (check actual keys returned by parser)
                    if (
                        "population_data" in parsed_data
                        and parsed_data["population_data"]
                    ):
                        logger.info(
                            f"  ✅ Extracted {len(parsed_data['population_data'])} population records"
                        )
                    if "gdp_data" in parsed_data and parsed_data["gdp_data"]:
                        logger.info(
                            f"  ✅ Extracted {len(parsed_data['gdp_data'])} GDP records"
                        )
                    if (
                        "economic_indicators" in parsed_data
                        and parsed_data["economic_indicators"]
                    ):
                        logger.info(
                            f"  ✅ Extracted {len(parsed_data['economic_indicators'])} indicator records"
                        )
                    if "poverty_data" in parsed_data and parsed_data["poverty_data"]:
                        logger.info(
                            f"  ✅ Extracted {len(parsed_data['poverty_data'])} poverty records"
                        )
                else:
                    logger.warning(f"  ⚠️  No data extracted from document")

            except Exception as e:
                logger.error(f"  ❌ Error processing {doc['title']}: {e}")
                results["errors"].append(
                    {
                        "document": doc["title"],
                        "error": str(e),
                    }
                )

        # Step 3: Load - Insert data into database
        logger.info(f"\n[Step 3/3] Aggregating parsed data...")

        # Aggregate all parsed data by type
        all_records = {
            "population": [],
            "gdp": [],
            "economic_indicators": [],
            "poverty_indices": [],
        }

        for parsed_data in all_parsed_data:
            if "population_data" in parsed_data:
                all_records["population"].extend(parsed_data["population_data"])
            if "gdp_data" in parsed_data:
                all_records["gdp"].extend(parsed_data["gdp_data"])
            if "economic_indicators" in parsed_data:
                all_records["economic_indicators"].extend(
                    parsed_data["economic_indicators"]
                )
            if "poverty_data" in parsed_data:
                all_records["poverty_indices"].extend(parsed_data["poverty_data"])

        # Log aggregated counts
        logger.info(f"\nAggregated data from {len(all_parsed_data)} documents:")
        for data_type, records in all_records.items():
            logger.info(f"  {data_type}: {len(records)} records")
            results["records_loaded"] += len(records)

        # TODO: Implement database loading once schema is verified
        # For now, we've successfully parsed the data and can verify the extraction works
        logger.info(
            f"\n⚠️  Database loading skipped (needs load_knbs_data method implementation)"
        )
        logger.info(f"✅ Data successfully parsed and aggregated")

        # # Uncomment when load_knbs_data is implemented
        # loader = DatabaseLoader(
        #     db_host=os.getenv("DB_HOST"),
        #     db_port=int(os.getenv("DB_PORT", "6543")),
        #     db_name=os.getenv("DB_NAME"),
        #     db_user=os.getenv("DB_USER"),
        #     db_password=os.getenv("DB_PASSWORD"),
        #     db_sslmode=os.getenv("DB_SSLMODE", "require"),
        # )
        #
        # # Load each data type
        # for data_type, records in all_records.items():
        #     if records:
        #         logger.info(f"\nLoading {len(records)} {data_type} records...")
        #         try:
        #             loaded_count = loader.load_knbs_data(data_type, records)
        #             results["records_loaded"] += loaded_count
        #             logger.info(f"✅ Loaded {loaded_count} {data_type} records")
        #         except Exception as e:
        #             logger.error(f"❌ Failed to load {data_type}: {e}")
        #             results["errors"].append(
        #                 {
        #                     "data_type": data_type,
        #                     "error": str(e),
        #                 }
        #             )
        #
        # loader.close()

    except Exception as e:
        logger.error(f"❌ Pipeline error: {e}")
        import traceback

        logger.error(traceback.format_exc())
        results["errors"].append(
            {
                "stage": "pipeline",
                "error": str(e),
            }
        )

    # Summary
    results["end_time"] = datetime.now().isoformat()

    logger.info("\n" + "=" * 80)
    logger.info("KNBS ETL Pipeline Test Complete")
    logger.info("=" * 80)
    logger.info(f"Documents discovered: {results['documents_discovered']}")
    logger.info(f"Documents parsed: {results['documents_parsed']}")
    logger.info(f"Records extracted: {results['records_loaded']}")
    logger.info(f"Errors: {len(results['errors'])}")

    if results["errors"]:
        logger.info("\nErrors encountered:")
        for error in results["errors"]:
            logger.info(f"  - {error}")

    return results


if __name__ == "__main__":
    results = asyncio.run(test_knbs_pipeline())

    # Exit with error code if pipeline failed
    if results["errors"]:
        sys.exit(1)
