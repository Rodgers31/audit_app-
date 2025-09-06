import argparse
import os
import sys
import time

# Ensure ETL module is on path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ETL_DIR = os.path.join(BASE_DIR, "etl")
if ETL_DIR not in sys.path:
    sys.path.append(ETL_DIR)


def run(source_key: str):
    import importlib

    kp = importlib.import_module("kenya_pipeline")
    KenyaDataPipeline = getattr(kp, "KenyaDataPipeline")
    pipeline = KenyaDataPipeline()

    t0 = time.time()
    docs = pipeline.discover_budget_documents(source_key)
    dt = time.time() - t0
    print(f"DISCOVERY {source_key}: count={len(docs)} time={dt:.1f}s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source", choices=["treasury", "cob", "oag", "all"], default="all"
    )
    args = parser.parse_args()

    sources = ["treasury", "cob", "oag"] if args.source == "all" else [args.source]
    for s in sources:
        run(s)
