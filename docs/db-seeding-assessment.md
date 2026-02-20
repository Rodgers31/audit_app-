# Database Seeding Assessment – Kenya Audit App Backend

Last updated: 2025-10-26

This document records the current state of data seeding, catalogues remaining mock/static data usages, and outlines the planned implementation path for replacing them with production-grade, idempotent database seeders fed by live Kenyan government sources.

## 1. Key Requirements (confirmed by user)

- Every FastAPI endpoint must source its payloads from the database (no runtime fallbacks to mock data).
- Replace all static JSON/fixture data with live fetches from public Kenyan government data portals, APIs, or documents. Where authentication may be required, support API keys via env vars but assume public access when possible.
- Seeder must be idempotent, safe to run repeatedly, support dry-run mode, and include retries, backoff, and rate limiting (~1 req/sec by default, configurable).
- No seeding during app startup; instead provide a standalone job (scheduled via GitHub Actions) that performs initial load and periodic updates.
- Provide tests (unit + integration) covering fetch, parse, and persistence layers.
- Document usage, configuration, scheduling, and secret handling.

## 2. Current Seeding & Data Flow Snapshot

| Table / Domain                                                                                                           | Current Source                                                                                                | Notes                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `countries`, `fiscal_periods`, `entities`, `budget_lines`, `audits`                                                      | `backend/bootstrap.py` using static JSON files (`apis/enhanced_county_data.json`, `apis/oag_audit_data.json`) | Invoked on FastAPI startup; no external fetch; limited error handling; inserts aggregate “total budget” only. |
| `source_documents`                                                                                                       | Same bootstrap script, derived metadata                                                                       | Only two synthetic documents (budget & audit) per county; no actual downloads.                                |
| `loans`, `population_data`, `gdp_data`, `economic_indicators`, `poverty_indices`, `quick_questions`, `annotations`, etc. | Not seeded                                                                                                    | Endpoints relying on these fallback to mock blocks or return empty.                                           |
| ETL scripts in `/etl`                                                                                                    | Mix of legacy mock data generators and ad-hoc scripts                                                         | None wired into automated process.                                                                            |
| Frontend e2e                                                                                                             | Stubs responses                                                                                               | Will rely on API returning DB data once seeded.                                                               |

## 3. Mock / Static Data Inventory (Priority Targets)

### 3.1 FastAPI (`backend/main.py`)

- **Explicit mock fallbacks:**

  - `/api/v1/countries` (lines ~699-760) – returns hard-coded `mock_countries` if DB empty/errors.
  - `/api/v1/entities` (lines ~2230-2385) – returns `mock_entities` on failure (recently reduced but still present).
  - Multiple county endpoints (`/counties`, `/financial`, `/budget`, `/debt`, `/audits`, `/audits/history`, etc.) still combine DB lookups with fallback logic (search for `mock`, `sample`, or comments like “Return mock data”).
  - `/api/v1/sources/status`, `/api/v1/debt/national`, `/api/v1/storage/status`, `/_read_etl_manifest` utilities rely on static heuristics or JSON snapshots under `analysis/` / `data/` directories.

- **Legacy aggregator sections:** bottom of file contains aggregated dashboards built from mock manifests (`analysis/...json`).

### 3.2 Alternate App Entrypoint

- `backend/main_simple.py` – standalone FastAPI with only mock data; should be deprecated or gated for demo only.

### 3.3 Data Packages & Services

- `backend/data/question_seeder.py` – `SAMPLE_QUESTIONS`; no live pull from curricula sources.
- `services/hybrid_question_service.py` & `external_question_service.py` – random sample from static lists; needs integration with real question datasets (e.g., curricula, KNBS facts).
- `services/economic.py` router references placeholder data.

### 3.4 Static Assets / JSON

- `/apis/*.json`, `/data/*.json`, `analysis/*.json`, etc. store scraped snapshots. Need to evaluate as fallback-only (dev) or convert into cached reference with provenance.

### 3.5 Tests & Fixtures

- Pytest fixtures rely on static seeds; once new seeding pipeline exists we should swap to using local test DB seeded via same orchestrator (with deterministic subset).

## 4. Target Data Sources Per Endpoint

| Endpoint / Feature                               | Required Tables                                                                                                | Candidate Live Sources                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/countries`, `/countries/{id}/summary`   | `countries`, `fiscal_periods`, aggregated metrics                                                              | Treasury / Controller of Budget publications for macro stats; World Bank for comparisons (if needed).                           |
| `/api/v1/counties*`                              | `entities`, `budget_lines`, `population_data`, `gdp_data`, `economic_indicators`, `source_documents`, `audits` | Kenyan County Treasury budgets (PDF/CSV), OAG reports, KNBS datasets (population, GDP), Controller of Budget quarterly reports. |
| `/api/v1/entities*`                              | `entities`, `budget_lines`, `audits`, `source_documents`                                                       | Same as above plus Ministries/Agencies budget publications.                                                                     |
| `/api/v1/debt/national`                          | `loans`, `economic_indicators`                                                                                 | National Treasury debt register, CBK reports.                                                                                   |
| `/api/v1/docs/resolve`, `/source-documents/{id}` | `source_documents`, `extractions`                                                                              | Raw document metadata and download links from e-procurement portals, Gazette notices, etc.                                      |
| Learning hub / quiz endpoints                    | `quick_questions`, `question_category`, `user_question_answers`                                                | KNBS factsheets, Controller of Budget explainers, Ministry of Finance educational materials.                                    |
| Storage / ETL status endpoints                   | `source_documents`, (future) `ingestion_jobs`                                                                  | Should reflect actual ingestion pipeline metadata rather than static manifests.                                                 |

## 5. Proposed Implementation Roadmap

### Phase 1 – Discovery & Design (current step)

1. Complete mock data catalog (this document).
2. Draft source mapping (above) and confirm with stakeholders (✅ confirmed).
3. Define DB schema adjustments if necessary (e.g., add `ingestion_jobs`, `source_hash`, `last_seen_at`).

### Phase 2 – Seeding Framework

1. Create `backend/seeding/` package with modules:
   - `config.py` – rate limits, endpoints, toggle dry-run.
   - `http.py` – shared HTTP client with politeness, retries (use `httpx` or `requests` + `tenacity`).
   - `fetchers/{domain}.py` – download raw payloads (e.g., `counties_budget.py`).
   - `parsers/{domain}.py` – convert raw data to normalized records (pydantic models).
   - `writers/{domain}.py` – persist using SQLAlchemy with upsert semantics.
   - `cli.py` – entrypoint (`python -m seeding.cli run --domain counties --dry-run`).
2. Integrate structured logging (JSON logs) and metrics counters.
3. Guarantee idempotency via `ON CONFLICT` upserts or `session.merge` + deterministic identifiers.
4. Support incremental updates using `last_modified` metadata where available.

### Phase 3 – Domain Implementations

- **Counties Budgets & Entities**

  - Fetch Controller of Budget datasets (CSV/Excel) and county budget PDFs (parse totals via heuristics or provided numbers).
  - Populate `entities`, `budget_lines`, `source_documents`; attach provenance metadata (URL, fetch timestamp, hash).

- **Audits**

  - Scrape OAG website for county audit PDFs & summary tables.
  - Parse findings (if structured; otherwise store summary in `provenance`).

- **Population & Economic Indicators**

  - Pull KNBS data (CSV/Excel) for population, GDP, inflation; seed `population_data`, `gdp_data`, `economic_indicators`, `poverty_indices`.

- **National Debt / Loans**

  - Scrape Treasury debt reports; populate `loans` or new aggregated table.

- **Learning Hub Questions**

  - Replace static `SAMPLE_QUESTIONS` with curated dataset (KNBS quizzes, OAG educational materials). Possibly treat as separate ingestion with manual curation.

- **Document Catalog**
  - Track all source PDFs/CSVs in `source_documents` with `md5`, file metadata, and optional S3 storage pointer.

Each domain should expose `seed_<domain>(session, dry_run=False)` callable used by CLI.

### Phase 4 – Testing & QA

1. Unit tests for each fetcher using recorded fixtures (e.g., `pytest` + `respx`/`responses`).
2. Integration tests with ephemeral Postgres (use `pytest` + `docker` service) verifying idempotent writes.
3. Contract tests ensuring FastAPI endpoints return data after seeding.
4. Playwright regression (already running) to validate UI states.

### Phase 5 – Operations & Documentation

1. Add `docs/seeding-guide.md` covering:
   - Configuration (`.env` keys, rate limits, optional proxies).
   - Running locally (`python -m seeding.cli run all --dry-run`).
   - Observability (log paths, metrics, failure handling).
   - Scheduling via GitHub Actions (sample workflow executing seeder nightly with secrets, storing artifacts/logs).
2. Update root `README.md` and backend docs referencing new process.
3. Provide GitHub Action workflow definition (`.github/workflows/seed.yml`) running seeder with caching of downloads.
4. Ensure secrets usage documented (use `GITHUB_TOKEN`, `KENYA_API_KEY` env, etc.).

### Phase 6 – Cleanup

1. Remove/flag mock code paths with feature flag `ALLOW_MOCK_DATA=false` by default; delete once DB seeding confirmed.
2. Archive static JSON snapshots to `data/archive/` for reference but not runtime use.
3. Deprecate `backend/main_simple.py` or restrict to demo mode.

## 6. Immediate Next Deliverables

1. **Technical design for `seeding/` package structure** – file layout, core abstractions, sample code skeleton (to be delivered next).
2. **Detailed source fetch specs** for each domain (URL endpoints, request method, parsing plan).
3. **List of schema adjustments** (if we need new tables/columns).
4. **Implementation tasks breakdown** with estimated complexity to guide phased rollout.

Once you review and approve this assessment + roadmap, I will proceed with the detailed design (Phase 2 blueprint) before touching code.
