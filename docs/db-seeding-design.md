# Database Seeding Design Blueprint

Last updated: 2025-10-26

This document expands on the seeding assessment and details the planned implementation for the production data ingestion pipeline.

## 1. Seeding Package Architecture

```text
backend/
  seeding/
    __init__.py
    cli.py                # entrypoint for manual / scheduled runs
    config.py             # environment-driven settings
    http_client.py        # shared HTTP client with politeness
    logging.py            # logging helpers (JSON formatting)
    rate_limiter.py       # token bucket or sleep-based limiter
    registries.py         # domain registry for CLI dispatch
    utils.py              # helpers (hashing, file downloads)
    types.py              # pydantic schemas for normalized records
    domains/
      __init__.py
      counties_budget/
        fetcher.py
        parser.py
        writer.py
      audits/
        fetcher.py
        parser.py
        writer.py
      economic_indicators/
        fetcher.py
        parser.py
        writer.py
      population/
        fetcher.py
        parser.py
        writer.py
      national_debt/
        fetcher.py
        parser.py
        writer.py
      learning_hub/
        fetcher.py
        parser.py
        writer.py
    storage/
      file_store.py        # optional S3/local persistence for downloaded docs
      cache.py             # memoization of HTTP responses if needed
```

### Key Modules

- `cli.py`

  - `seed` command accepts `--domain`, `--all`, `--dry-run`, `--since` (incremental date), `--config`.
  - Bootstraps logging, loads settings, obtains DB session (using `database.SessionLocal`).

- `config.py`

  - Centralizes environment variables: `SEED_RATE_LIMIT`, `SEED_TIMEOUT`, `KENYA_OPEN_DATA_API_KEY`, `SEED_STORAGE_PATH`, `SEED_USER_AGENT`.
  - Provides default fallbacks and convenience accessors.

- `http_client.py`

  - Wraps `httpx.AsyncClient` or sync `requests.Session` with:
    - Custom headers (`User-Agent`, contact email).
    - Retry / backoff via `tenacity` (retry on `HTTPStatusError`, connection errors).
    - Optional caching (ETag/If-Modified-Since) when remote supports it.

- `rate_limiter.py`

  - Simple async/sync rate limiter (1 req/sec default) using `asyncio.Semaphore` or `time.sleep` for sync tasks.
  - Support configurable burst and global limiter across domains.

- `domains/*`

  - Each domain exports `run(session, settings, dry_run=False)` invoked by CLI.
  - `fetcher.py` downloads raw assets (CSV, JSON, PDFs) and returns normalized payloads (e.g., list of `BudgetRecordRaw`).
  - `parser.py` converts raw payloads to standardized Pydantic models defined in `types.py`.
  - `writer.py` persists via SQLAlchemy using upserts (Postgres `ON CONFLICT DO UPDATE`).
  - Writers record provenance in `source_documents` and optionally `ingestion_jobs` table.

- `storage/`
  - `file_store.py` handles saving downloaded PDFs/CSVs (based on config: local disk path or S3 bucket).
  - `cache.py` caches zipped downloads to avoid redundant fetches between runs.

## 2. External Data Sources & Access Patterns

| Domain                    | Source                                                                                                | Access Method                                                                                                         | Notes                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Counties budgets          | Controller of Budget (CoB) "County Budget Implementation Review Reports"; County Treasury budget PDFs | PDF downloads from CoB portal, parse summary tables via Camelot/tabula fallback; CSV/Excel attachments when available | Respect robots.txt; use HEAD checks for `Last-Modified`; store PDF metadata in `source_documents`. |
| Counties entities list    | National Treasury / CoB aggregated CSV                                                                | HTTP GET CSV; parse with pandas                                                                                       | Provide canonical IDs/ISO codes; align with `NAME_TO_ID_MAPPING`.                                  |
| County audit findings     | Office of Auditor-General (OAG) reports                                                               | PDF download; parse summary sections or convert to text for ingestion (store raw text in `provenance`)                | For short term, capture metadata + highlight counts; longer term, NLP extraction.                  |
| Population data           | KNBS (Kenya National Bureau of Statistics) "County Population" datasets                               | CSV/Excel download (open data portal)                                                                                 | Provide `year`, `total_population`, male/female breakdown when available.                          |
| GDP / economic indicators | KNBS "Gross County Product" + CPI / inflation datasets                                                | CSV/Excel / JSON                                                                                                      | Map to `gdp_data`, `economic_indicators`.                                                          |
| National debt             | National Treasury "Public Debt Bulletin" (PDF) + CBK data (CSV)                                       | PDF scraping or manual CSV, track total debt, composition                                                             | May need manual curated dataset if parsing unreliable.                                             |
| Learning hub questions    | KNBS/CoB educational materials, curated Q&A                                                           | For initial version, maintain structured CSV curated from official sources                                            | Provide `category`, `difficulty`, `source_url`.                                                    |
| Source documents          | All above publications                                                                                | Store metadata (url, md5, doc_type) and optionally download to storage backend                                        | Link to derived budget lines/audits via `source_document_id`.                                      |

## 3. Database Schema Adjustments

1. `source_documents`

   - Add `status` (enum: `available`, `archived`, `failed`).
   - Add `last_seen_at` (datetime) for incremental updates.

2. `BudgetLine`

   - Add `source_hash` (string) to detect changes in upstream records.
   - Ensure `category`/`subcategory` match parsed taxonomy (maybe new `budget_category` table?).

3. `Audit`

   - Add `summary` text field for parsed highlight.
   - Add `source_reference` (string) for page/section markers.

4. New table `ingestion_jobs`

   - `id`, `domain`, `started_at`, `finished_at`, `status`, `items_processed`, `items_created`, `items_updated`, `errors`, `metadata` JSONB.
   - Enables reporting and GitHub Action logs.

5. Optional `external_dataset_cache`
   - Track dataset URLs, `etag`, `last_modified`, `content_hash` to avoid re-downloading unchanged assets.

## 4. Workflow & Scheduling

- **Manual run**

  - `python -m seeding.cli seed --all --dry-run` for local smoke test.
  - `python -m seeding.cli seed --domain counties_budget` for targeted update.

- **GitHub Actions workflow** (`.github/workflows/seed.yml`)

  ```yaml
  name: Nightly Database Seeding
  on:
    schedule:
      - cron: '0 2 * * *'
    workflow_dispatch:
  jobs:
    seed:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-python@v5
          with:
            python-version: '3.12'
        - name: Install deps
          run: pip install -r backend/requirements.txt
        - name: Run seeding orchestration
          env:
            DATABASE_URL: ${{ secrets.DATABASE_URL }}
            KENYA_OPEN_DATA_API_KEY: ${{ secrets.KENYA_OPEN_DATA_API_KEY }}
            SEED_RATE_LIMIT: '60/min'
          run: python -m seeding.cli seed --all
        - name: Upload logs
          uses: actions/upload-artifact@v4
          with:
            name: seed-logs
            path: seeding-logs/
  ```

- **Observability**
  - Logs stored under `logs/seeding/{date}.json` or uploaded as workflow artifact.
  - `ingestion_jobs` records allow API endpoint `/api/v1/admin/ingestion-jobs` to show history.

## 5. Testing Strategy

1. **Unit tests**

   - `tests/seeding/test_fetchers.py`: use `respx` (async) or `responses` (sync) with fixture responses to ensure proper request headers, retries, and parsing.
   - `tests/seeding/test_parsers.py`: feed sample CSV/JSON/PDF extracts to check normalization output.

2. **Integration tests**

   - Use temporary Postgres (docker or `pytest-postgresql`) to run `seed_<domain>` in dry-run and live mode verifying `items_created`/`items_updated` counts.
   - Validate idempotency by running seeder twice and ensuring no duplicates.

3. **Contract tests**

   - After seeding, call API endpoints in `backend/main.py` to ensure they return populated data and no fallback path triggers.

4. **End-to-end regression**

   - Existing Playwright suite should pass without stubbing once seeding pipeline populates DB in CI environment.

5. **PDF parsing coverage**
   - Provide sample PDFs in `tests/fixtures/pdfs/` (public domain) to test Camelot/tabula extraction; include skip markers if environment lacks `ghostscript`.

## 6. Implementation Task Breakdown

| #   | Task                                                                                                         | Files                                           | Complexity |
| --- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ---------- |
| 1   | Scaffold `backend/seeding/` package (empty modules, CLI skeleton)                                            | new package files                               | M          |
| 2   | Implement `config.py`, `logging.py`, `rate_limiter.py`, base `http_client.py` with retries and rate limiting | seeding core modules                            | M          |
| 3   | Add `ingestion_jobs` table migration & SQLAlchemy model                                                      | `backend/models.py`, migration                  | S          |
| 4   | Implement counties budget domain (fetch + parse + write)                                                     | `domains/counties_budget/*`                     | L          |
| 5   | Implement audit findings domain                                                                              | `domains/audits/*`                              | L          |
| 6   | Implement population & economic indicators domain                                                            | `domains/population/*`, `economic_indicators/*` | L          |
| 7   | Implement national debt / loans domain                                                                       | `domains/national_debt/*`                       | M          |
| 8   | Replace `SAMPLE_QUESTIONS` seeder with ingestion pipeline                                                    | `domains/learning_hub/*`, update services       | M          |
| 9   | Introduce `source_documents` enhancements + storage integration                                              | models, `storage/file_store.py`                 | M          |
| 10  | Update FastAPI endpoints to remove mock fallbacks and rely on seeded DB                                      | `backend/main.py`                               | M          |
| 11  | Add seeding tests (unit + integration)                                                                       | `tests/seeding/*`                               | M          |
| 12  | Create GitHub Action workflow for nightly seeding                                                            | `.github/workflows/seed.yml`                    | S          |
| 13  | Documentation updates (`docs/seeding-guide.md`, README)                                                      | docs                                            | S          |
| 14  | Remove legacy mock data scripts (`main_simple.py`, static JSON references)                                   | cleanup                                         | M          |

Complexity legend: S (Small, <=0.5d), M (Medium, ~1d), L (Large, multi-day).

## 7. Next Steps

1. Review this design blueprint.
2. Approve schema adjustments and package structure.
3. Begin implementation with Tasks #1–#3 (scaffold & infrastructure) followed by domain-specific seeding (Task #4 onward).

Once approved, I will start by scaffolding the `backend/seeding/` package and adding core utilities before diving into specific domain ingestion.
