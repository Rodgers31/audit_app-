"""
Run a tiny, safe ingestion batch to validate end-to-end extraction and DB loading.

It discovers a handful of recent documents per source (at most 2 each),
downloads, extracts, normalizes, and loads them, with basic idempotency in the loader.

Usage: Run via VS Code or `python scripts/ingest_small_batch.py`
"""

import asyncio
import os
import sys
from datetime import datetime

# Ensure imports resolve
REPO_ROOT = os.path.dirname(os.path.dirname(__file__))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from etl.kenya_pipeline import KenyaDataPipeline  # type: ignore


async def main():
    pipeline = KenyaDataPipeline()
    # Discover a small set per source
    docs = []
    for k in ["treasury", "cob", "oag"]:
        found = pipeline.discover_budget_documents(k)
        docs.extend(found[:2])  # up to 2 per source for a quick test

    processed = 0
    ok = 0
    for d in docs:
        res = await pipeline.download_and_process_document(d)
        processed += 1
        if res:
            ok += 1
        await asyncio.sleep(1)

    print(
        f"Ingestion finished at {datetime.now().isoformat()} — success {ok}/{processed}"
    )


if __name__ == "__main__":
    asyncio.run(main())
