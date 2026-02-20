# Kenya Audit Transparency App — Production Gaps & Roadmap

> **Generated**: 17 February 2026  
> **Purpose**: Track every gap between current state and production-ready, with prioritized implementation plan  
> **Status Legend**: ⬜ Not started · 🟡 In progress · ✅ Done

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Priority 1 — Frontend Data Fabrication (Critical)](#2-priority-1--frontend-data-fabrication-critical)
3. [Priority 2 — Backend Hardcoded/Stub Endpoints](#3-priority-2--backend-hardcodedstub-endpoints)
4. [Priority 3 — ETL Pipeline Gaps](#4-priority-3--etl-pipeline-gaps)
5. [Priority 4 — Data Quality & Transparency](#5-priority-4--data-quality--transparency)
6. [Priority 5 — Architectural Cleanup](#6-priority-5--architectural-cleanup)
7. [Priority 6 — UI/UX Issues](#7-priority-6--uiux-issues)
8. [Priority 7 — Infrastructure & Ops](#8-priority-7--infrastructure--ops)
9. [Implementation Order](#9-implementation-order)

---

## 1. System Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────────┐
│   Next.js UI    │────▶│  FastAPI Backend │────▶│   PostgreSQL (Supabase)  │
│  localhost:3000  │     │  localhost:8001  │     │                          │
└─────────────────┘     └────────┬────────┘     └──────────────────────────┘
                                 │                          ▲
                                 │                          │
                        ┌────────▼────────┐     ┌──────────┴───────────┐
                        │  Redis Cache    │     │   ETL Pipeline       │
                        │  localhost:6379  │     │  (Scrapers/Parsers)  │
                        └─────────────────┘     └──────────────────────┘
                                                        │
                                          ┌─────────────┼─────────────┐
                                          ▼             ▼             ▼
                                    treasury.go.ke  cob.go.ke   oagkenya.go.ke
                                                    knbs.or.ke
```

**Current state**: The pipeline _can_ scrape real government data, parse PDFs, and load into PostgreSQL. But the frontend largely **ignores the database** and displays fabricated numbers derived from a single `budget_2025` field.

---

## 2. Priority 1 — Frontend Data Fabrication (Critical)

These are the most damaging gaps. The UI shows numbers that look real but are **invented using fixed multipliers**.

### GAP 1.1 ⬜ County Data Transform Fabricates 15+ Fields

**File**: `frontend/lib/api/counties.ts` (transform function, ~lines 21-57)

**Problem**: The backend returns only 6 fields per county (`id`, `name`, `population`, `budget_2025`, `financial_health_score`, `audit_rating`). The frontend fabricates:

| Fabricated Field    | Formula               | Impact                                                  |
| ------------------- | --------------------- | ------------------------------------------------------- |
| `debt`              | `budget_2025 × 0.3`   | Every county shows identical 30% debt ratio             |
| `gdp`               | `budget_2025 × 2`     | Pure fiction — GDP has no relationship to county budget |
| `education`         | `budget_2025 × 0.3`   | All 47 counties show same sector split                  |
| `health`            | `budget_2025 × 0.25`  | Same for all counties                                   |
| `infrastructure`    | `budget_2025 × 0.2`   | Same for all counties                                   |
| `moneyReceived`     | `budget_2025 × 0.8`   | Invented                                                |
| `revenueCollection` | `budget_2025 × 0.4`   | Invented                                                |
| `pendingBills`      | `budget_2025 × 0.1`   | Invented                                                |
| `developmentBudget` | `budget_2025 × 0.4`   | Invented — national average is ~30%                     |
| `recurrentBudget`   | `budget_2025 × 0.6`   | Invented                                                |
| `totalDebt`         | `budget_2025 × 0.3`   | Duplicate of `debt`                                     |
| `coordinates`       | `[36.8219, -1.2921]`  | **All 47 counties pinned to Nairobi**                   |
| `lastAuditDate`     | `new Date()`          | Always "today"                                          |
| `auditIssues`       | `[]`                  | Always empty                                            |
| `code`              | `name.substring(0,3)` | Not the real county code                                |

**Fix required**:

1. Expand `GET /api/v1/counties` to return sector-level budget breakdown, actual debt, revenue, pending bills, dev/recurrent split, audit findings, and last audit date — all from real DB tables
2. Add real county centroid coordinates to entity metadata (47 known lat/lng pairs)
3. Remove all `× 0.3` / `× 0.25` fabrications from the transform function
4. Show "Data unavailable" instead of fake numbers when DB has no data

---

### GAP 1.2 ⬜ Budget Page Is 100% Hardcoded

**File**: `frontend/app/budget/page.tsx`

**Problem**: Zero API calls. All numbers are literal constants in the component:

- KES 3.28T (2023) and KES 3.7T (2024) total budgets
- Sector percentages (Education 27%, Health 11%, Infrastructure 17%, etc.)
- All chart data is static

**Unused hooks that should be wired**:

- `useBudgetAllocation()` → `GET /api/v1/counties/{id}/budget`
- `useNationalBudgetSummary()` → `GET /api/v1/budget/national`
- `useBudgetUtilizationSummary()` → `GET /api/v1/budget/utilization`
- `useBudgetTrends()` → `GET /api/v1/counties/{id}/budget/trends`
- `useSectorBudgetAllocation()` → `GET /api/v1/budget/sectors/{sector}`

**Fix required**:

1. Build `GET /api/v1/budget/national` endpoint that aggregates `BudgetLine` records by category
2. Build `GET /api/v1/budget/utilization` that computes actual vs allocated across fiscal years
3. Wire the budget page to call these hooks
4. Add fiscal year selector so users can compare FY2023/24 vs FY2024/25

---

### GAP 1.3 ⬜ Debt Timeline Chart Ignores Its Data Prop

**File**: `frontend/components/DebtTimelineChart.tsx`

**Problem**: The component receives a `data` prop but renders a **hardcoded** `DEBT_TIMELINE_DATA` array (2015–2024). The line chart never changes regardless of API data.

**Fix required**:

1. Build `GET /api/v1/debt/timeline` endpoint that queries `Loan` records grouped by issue year
2. Make the component use its `data` prop instead of the internal constant
3. Show loading state while data is fetched

---

### GAP 1.4 ⬜ Top Loans Section Falls Back to Hardcoded Array

**File**: `frontend/components/TopLoansSection.tsx`

**Problem**: Calls `useTopLoans()` → `GET /api/v1/debt/top-loans`, but on any error silently displays a hardcoded `TOP_LOANS` array.

**Fix required**:

1. Ensure `GET /api/v1/debt/top-loans` returns real loan records from the `Loan` table
2. Show clear "data unavailable" message instead of silently substituting fake data
3. Display source document reference for each loan

---

### GAP 1.5 ⬜ Federal Reports & Ministry Audits Are Hardcoded

**File**: `frontend/app/reports/page.tsx`

**Problem**: County reports use the API, but "Federal Projects" (SGR, Affordable Housing, Digital Literacy) and "Ministry Audits" (Health, Education) are **100% hardcoded** with fabricated findings and amounts.

**Fix required**:

1. Create `GET /api/v1/audits/national` for national government/ministry audits
2. Create `GET /api/v1/audits/projects` for major federal project audits
3. Wire the reports page to call these endpoints
4. Wire unused hooks: `useAuditReports()`, `useAuditStatistics()`, `useCountyAuditReports()`

---

### GAP 1.6 ⬜ Debt Page Uses Hardcoded Fallback Values

**Files**: `frontend/app/debt/page.tsx`, `frontend/components/NationalDebtPanel.tsx`

**Problem**: Both have extensive hardcoded fallback objects (total_debt: 11500B, debt_to_gdp: 70.2%, per_capita calculation with population 54M, domestic: 4600B, external: 6900B). These silently activate when the API fails — users never know they're seeing stale data.

**Fix required**:

1. Show explicit "API unavailable — showing cached data from [date]" banner
2. Add `last_updated` timestamp to debt response
3. Persist last-known-good debt data with timestamp in the backend

---

## 3. Priority 2 — Backend Hardcoded/Stub Endpoints

### GAP 2.1 ⬜ Country Summary Is Entirely Static

**File**: `backend/main.py` — `GET /api/v1/countries/{id}/summary`

**Problem**: Returns hardcoded text: "KES 3.2T budget, KES 8.5T debt" regardless of database contents. This feeds the main dashboard.

**Fix**: Replace with real aggregation: `SUM(BudgetLine.allocated_amount)`, `SUM(Loan.outstanding)`, `COUNT(Audit)`, latest fiscal period.

---

### GAP 2.2 ⬜ County Debt Endpoint Is a Placeholder

**File**: `backend/main.py` — `GET /api/v1/counties/{id}/debt`

**Problem**: Calculates debt as `budget_2025 × 0.3`. No real county debt data.

**Fix**: Query `Loan` table by entity + pending bills from `BudgetLine` where category matches. If no data, return `null` with explanation instead of fabricated numbers.

---

### GAP 2.3 ⬜ Dashboard Endpoints Return Static Data

**File**: `backend/main.py`

| Endpoint                                          | Problem                                      |
| ------------------------------------------------- | -------------------------------------------- |
| `GET /api/v1/dashboards/national/debt-mix`        | Returns static 60/40 external/domestic split |
| `GET /api/v1/dashboards/national/fiscal-outturns` | Stub quarterly time series                   |
| `GET /api/v1/dashboards/national/sector-ceilings` | Static sector percentages                    |

**Fix**: Build each from `Loan` (debt-mix), `BudgetLine` grouped by period (fiscal-outturns), `BudgetLine` grouped by category (sector-ceilings).

---

### GAP 2.4 ⬜ TODO Stub Endpoints (No-ops)

| Endpoint                             | Current Behavior                  | Fix Needed                                                     |
| ------------------------------------ | --------------------------------- | -------------------------------------------------------------- |
| `GET /api/v1/analytics/top_spenders` | Returns `{"top_spenders": []}`    | Aggregate `BudgetLine.actual_spent` by entity, sort descending |
| `POST /api/v1/annotations`           | Always returns `{"id": 1}`        | Implement real annotation CRUD                                 |
| `POST /api/v1/documents/upload`      | Always returns `{"id": 1}`        | Implement file upload to S3 + SourceDocument record            |
| `GET /api/v1/etl/status/{job_id}`    | Always returns static "completed" | Query `IngestionJob` table by ID                               |

---

### GAP 2.5 ⬜ Missing Endpoints (Data Model Exists, No API)

| Missing Endpoint                           | Model Ready?                     | Description                                                         |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------- |
| `GET /api/v1/loans`                        | ✅ `Loan` table exists           | List/filter loans by entity, lender, debt category                  |
| `GET /api/v1/fiscal-periods`               | ✅ `FiscalPeriod` table exists   | List fiscal periods for navigation/filtering                        |
| `GET /api/v1/quick-questions`              | ✅ `QuickQuestion` table exists  | Quiz questions for the Learning Hub                                 |
| `POST /api/v1/quick-questions/{id}/answer` | ✅ `UserQuestionAnswer` exists   | Submit quiz answers, track learning                                 |
| `GET /api/v1/budget-lines`                 | ✅ `BudgetLine` table exists     | Top-level budget line search (currently nested under entity/period) |
| `GET /api/v1/source-documents`             | ✅ `SourceDocument` table exists | List/search source documents (currently single-doc lookup only)     |
| `GET /api/v1/audits/search`                | ✅ `Audit` table exists          | Full-text search in audit findings (excluded from `/search`)        |

---

### GAP 2.6 ⬜ Debt-to-GDP Ratio Hardcoded

**File**: `backend/main.py` — national debt endpoint

**Problem**: Uses `KES 14T` as a constant for GDP. Should query `GDPData` table for latest national GDP value.

---

## 4. Priority 3 — ETL Pipeline Gaps

### GAP 3.1 ⬜ OpenData Source Is a Ghost Entry

**File**: `etl/smart_scheduler.py`

**Problem**: Scheduled for weekly runs on Fridays but **zero implementation code**. No discovery, download, or parsing functions exist.

**Fix**: Implement Kenya Open Data CKAN API integration (`opendata.go.ke/api/3/action/package_search`). Machine-readable datasets for budget data, county statistics, and development projects.

---

### GAP 3.2 ⬜ CRA Source Is a Ghost Entry

**File**: `etl/smart_scheduler.py`

**Problem**: Scheduled for monthly runs + February allocation season but **zero implementation**. No code exists.

**Fix**: Implement scraper for `cra.go.ke`. CRA publishes:

- Division of Revenue Act (DORA) allocations
- County Allocation of Revenue Act (CARA) — the exact formula for how money flows to counties
- Quarterly county revenue monitoring reports

---

### GAP 3.3 ⬜ No Dedicated Debt/Loan Parser

**Problem**: Treasury Annual Borrowing Plan PDFs are downloaded but parsed through the generic table normalizer. Debt-specific fields (lender name, interest rate, maturity date, currency, loan purpose) are lost — everything becomes generic budget lines.

**Fix**: Build `etl/debt_parser.py` that:

- Extracts lender, principal, outstanding, interest rate, maturity date from Treasury debt PDFs
- Creates `Loan` records (not `BudgetLine` records)
- Classifies into `DebtCategory` enum (external_multilateral, domestic_bonds, etc.)

---

### GAP 3.4 ⬜ Only 7 of 47 Counties in the Normalizer Entity Map

**File**: `etl/normalizer.py` — `DataNormalizer.entity_mappings["counties"]`

**Problem**: Only Nairobi, Mombasa, Kisumu, Nakuru, Uasin Gishu, Machakos, and Kiambu have entity aliases. The other 40 counties get `confidence: 0.1` and `type: "unknown"` — their data is effectively discarded during validation (min confidence 0.7).

**Fix**: Add all 47 counties with their common name variants (e.g., "Murang'a" / "Muranga" / "Murang'a County").

---

### GAP 3.5 ⬜ Hardcoded USD/KES Exchange Rate

**File**: `etl/normalizer.py`

**Problem**: `rate: 145.0` with comment "should be dynamic". As of Feb 2026, the rate is ~KES 129/USD. This affects any dollar-denominated figures.

**Fix**: Fetch live rate from CBK or a free FX API on pipeline startup. Cache for the duration of the run.

---

### GAP 3.6 ⬜ KNBS Extractor Dependency Is Fragile

**Problem**: `KNBSExtractor` lives at `extractors/government/knbs_extractor.py` outside the `etl/` package. If the import fails (likely), KNBS discovery returns an empty list. No KNBS data flows in.

**Fix**: Move `KNBSExtractor` into `etl/` or make the import path robust. Verify the module exists and is functional.

---

### GAP 3.7 ⬜ source_registry.py Is Dead Code

**File**: `etl/source_registry.py`

**Problem**: The pipeline ignores it completely, using its own `kenya_sources` dict. The registry imports and instantiates at load time but serves no purpose.

**Fix**: Either wire the registry into the pipeline as the single source of truth, or delete it.

---

### GAP 3.8 ⬜ Alert System Is a Stub

**File**: `etl/monitored_runner.py`

**Problem**: Tries to import `backend.monitoring.alerts` which doesn't exist. Alert dispatch silently fails. No one knows when ETL breaks.

**Fix**: Implement alerting via:

- Email (SMTP config already in settings)
- Slack webhook (simple HTTP POST)
- Write failed job details to `IngestionJob` with `FAILED` status

---

### GAP 3.9 ⬜ MVP Throttle Limits Real Throughput

**File**: `etl/kenya_pipeline.py` — `run_full_pipeline()`

**Problem**: Processes only the **5 most recent documents per source** per run. Full historical ingestion requires running `backfill.py` separately.

**Fix**: Make the throttle configurable via `ETL_MAX_DOCS_PER_SOURCE` env var. Default to 5 for dev, 50+ for production.

---

### GAP 3.10 ⬜ No Retry Queue for Failed Documents

**Problem**: If `download_and_process_document()` fails, it returns `None` and moves on. Failed documents are never retried unless the entire pipeline re-runs and re-discovers them.

**Fix**: Track failed documents in `SourceDocument` with `status=FAILED` and retry them with exponential backoff on subsequent runs.

---

## 5. Priority 4 — Data Quality & Transparency

### GAP 4.1 ⬜ No Data Provenance in the UI

**Problem**: Every number in the UI lacks a source reference. The data model has `provenance` JSONB columns and `SourceDocument` records, but the frontend never shows them.

**Fix**: Add "Source: [document name], p.[page], fetched [date]" tooltip/link to every data point. Let users click through to the original PDF.

---

### GAP 4.2 ⬜ No Data Freshness Indicators

**Problem**: Users can't tell if they're seeing data from 2024 or 2020. No timestamps, no "last updated" labels.

**Fix**: Add `data_as_of` and `source_document_date` to all API responses. Show "Data from FY2024/25 Budget Implementation Report, published 15 Jan 2025" in the UI.

---

### GAP 4.3 ⬜ Confidence Scores Not Surfaced

**Problem**: The ETL parser generates `confidence` (0.0–1.0) for extracted data. Never shown to users.

**Fix**: Add a reliability indicator (green/yellow/red dot) next to data points. Tooltip: "Confidence: 0.85 — extracted from table on page 42".

---

### GAP 4.4 ⬜ Audit Findings Not Searchable

**File**: `backend/main.py` — `GET /api/v1/search`

**Problem**: Searches entities, budget lines, and documents but **excludes audit findings**. Users can't search for "irregular expenditure Nairobi" or "unsupported payment Mombasa".

**Fix**: Add `Audit.finding_text` and `Audit.recommended_action` to the search query.

---

## 6. Priority 5 — Architectural Cleanup

### GAP 5.1 ⬜ main.py Is 3,700 Lines

**Problem**: Nearly all API logic in one file. Untestable, unmaintainable, hard to review.

**Fix**: Move endpoints into dedicated routers:

- `routers/counties.py` — all `/counties/*` endpoints
- `routers/debt.py` — all `/debt/*` endpoints
- `routers/budget.py` — all `/budget/*` endpoints
- `routers/audits.py` — all `/audits/*` endpoints
- `routers/dashboards.py` — all `/dashboards/*` endpoints
- `routers/documents.py` — all `/documents/*` and `/source-documents/*`
- `routers/search.py` — search endpoint
- `routers/system.py` — seeder status, storage status, ETL triggers

---

### GAP 5.2 ⬜ Three Competing Seeding Systems

**Problem**: `backend/bootstrap.py`, `backend/seeding/cli.py`, and `backend/services/auto_seeder.py` all create entity records independently. They can conflict.

**Fix**:

1. Keep `backend/seeding/cli.py` as the single seeder (best architecture: registry pattern, job tracking, dry-run)
2. Wire `auto_seeder.py` to call the CLI domains instead of having its own `LiveDataAggregator`
3. Deprecate `bootstrap.py` and `bootstrap_data.py`

---

### GAP 5.3 ⬜ database.py vs database_enhanced.py

**Problem**: Two database modules coexist. `main.py` imports from `database.py`. `health.py` tries to import `get_pool_status()` which only exists in `database_enhanced.py`.

**Fix**: Merge into a single `database.py` with production pool settings, `get_pool_status()`, and monitoring hooks.

---

### GAP 5.4 ⬜ ~20 Unused React Query Hooks

**Problem**: Defined in `frontend/lib/react-query/` but never called by any component:

- `useAuditReports`, `useAuditStatistics`, `useAuditReport`, `useCountyAuditReports`
- `useBudgetAllocation`, `useNationalBudgetSummary`, `useBudgetUtilizationSummary`, `useBudgetTrends`, `useSectorBudgetAllocation`
- `useDashboardStats`, `useNationalOverview`, `usePerformanceRankings`, `useSectorPerformance`
- `useRegionalAnalysis`, `useNationalTrends`, `useAuditComplianceStats`
- `useFinancialHealthIndicators`, `useTransparencyIndex`, `useAlertsAndNotifications`
- `useDebtTimeline`, `useDebtComparison`, `useDebtSustainabilityIndicators`, `useDebtRiskAssessment`

**Fix**: Wire hooks to their respective pages as backend endpoints are built, or remove ones that will never be used.

---

### GAP 5.5 ⬜ Fixture Data Is Toy-Scale

**Problem**: Seeding fixtures contain single records (one Nairobi budget line, one audit finding). National debt fixtures total KES 95B vs real ~KES 10T+.

**Fix**: Populate fixtures with realistic multi-county, multi-period data. At minimum: all 47 counties × 2 fiscal years × 5 budget categories = 470 budget line records.

---

## 7. Priority 6 — UI/UX Issues

### GAP 6.1 ⬜ No Mobile Navigation Menu

**Problem**: Hamburger icon exists in `Navigation.tsx` but no toggle/dropdown implementation. Mobile users can't navigate.

---

### GAP 6.2 ⬜ No Error Boundaries

**Problem**: Component-level render errors crash entire pages. No graceful degradation.

---

### GAP 6.3 ⬜ No 404 Page

**Problem**: Invalid routes show blank page or Next.js default error.

---

### GAP 6.4 ⬜ Audit Report Cards Use Template Text

**Problem**: Every "qualified" county shows "KES 450M irregular expenditure", every "adverse" shows "KES 2.1B". These are template strings, not from real audit data.

---

### GAP 6.5 ⬜ recharts Dependency Installed But Unused

**Problem**: Dead dependency in `package.json`. All charts are custom SVG.

**Fix**: Remove from dependencies or migrate charts to recharts for consistency.

---

### GAP 6.6 ⬜ simple-mock-data.ts Is Orphaned

**Problem**: Full 47-county mock dataset in `frontend/data/simple-mock-data.ts` is not imported by any component.

**Fix**: Delete or repurpose as test fixture.

---

## 8. Priority 7 — Infrastructure & Ops

### GAP 7.1 ⬜ No Per-Source Health Dashboard

**Problem**: No way to see "Treasury scraper last succeeded 3 days ago, COB scraper failing since Jan 15".

**Fix**: Build `GET /api/v1/admin/sources/health` that reports per-source: last success, last failure, success rate, next scheduled run, documents extracted.

---

### GAP 7.2 ⬜ InternalAPIClient Cache Has No Limits

**File**: `backend/main.py` — `InternalAPIClient`

**Problem**: In-memory dict cache with 6-hour TTL but no size limit, no eviction, no thread safety. Can grow unbounded.

**Fix**: Use `cachetools.TTLCache` with `maxsize` or lean on Redis exclusively.

---

### GAP 7.3 ⬜ SSL Verification Disabled

**Problem**: ETL pipeline uses `verify=False` for government sites (OAG, COB) due to SSL cert issues. This is a security risk.

**Fix**: Pin the government CA certificates or use a custom cert bundle.

---

### GAP 7.4 ⬜ No Database Migrations in CI/CD

**Problem**: Alembic is configured (`backend/alembic/`) but no evidence of migration runs in the CI pipeline (`docker-compose.yml` doesn't run migrations).

**Fix**: Add `alembic upgrade head` to container startup or CI pipeline.

---

## 9. Implementation Order

Recommended sequence for maximum impact:

### Phase 1: Make Data Real (Weeks 1-2)

1. **GAP 1.1** — Expand county API response with real DB data, add coordinates
2. **GAP 1.2** — Build national budget endpoints, wire budget page
3. **GAP 2.1** — Replace hardcoded country summary with DB aggregation
4. **GAP 2.2** — Replace county debt placeholder with real query
5. **GAP 1.3** — Make debt timeline chart use its data prop
6. **GAP 2.6** — Use real GDP from DB for debt-to-GDP ratio

### Phase 2: Complete the ETL (Weeks 3-4)

7. **GAP 3.4** — Add all 47 counties to normalizer
8. **GAP 3.3** — Build dedicated debt/loan parser
9. **GAP 3.6** — Fix KNBS extractor import
10. **GAP 3.9** — Make document throttle configurable
11. **GAP 3.5** — Dynamic exchange rate
12. **GAP 3.10** — Retry queue for failed documents

### Phase 3: Frontend Polish (Weeks 5-6)

13. **GAP 1.5** — Wire federal reports/ministry audits to API
14. **GAP 1.6** — Add stale data indicators on debt page
15. **GAP 4.1** — Show data provenance in UI
16. **GAP 4.2** — Show data freshness timestamps
17. **GAP 6.1** — Mobile navigation
18. **GAP 6.2** — Error boundaries
19. **GAP 6.3** — 404 page

### Phase 4: Architecture & Ops (Weeks 7-8)

20. **GAP 5.1** — Break up main.py into routers
21. **GAP 5.2** — Unify seeding systems
22. **GAP 5.3** — Merge database modules
23. **GAP 3.8** — Implement alerting
24. **GAP 7.1** — Source health dashboard
25. **GAP 7.4** — Database migrations in CI

### Phase 5: New Sources & Features (Weeks 9-10)

26. **GAP 3.1** — Implement Kenya Open Data source
27. **GAP 3.2** — Implement CRA source
28. **GAP 2.5** — Build missing endpoints (loans, fiscal periods, quiz, search)
29. **GAP 4.3** — Confidence score indicators in UI
30. **GAP 4.4** — Audit findings search

---

## Appendix: Government Data Sources Reference

| Source                   | Website           | What They Publish                                                    | Frequency                             |
| ------------------------ | ----------------- | -------------------------------------------------------------------- | ------------------------------------- |
| **National Treasury**    | treasury.go.ke    | Budget Policy Statement, QEBR, Annual Borrowing Plan, debt bulletins | Quarterly + annual                    |
| **Controller of Budget** | cob.go.ke         | County & National Budget Implementation Review Reports               | Quarterly (45 days after quarter-end) |
| **Auditor General**      | oagkenya.go.ke    | County audit reports, national audit reports, special audits         | Annual (Nov-Jan) + quarterly specials |
| **KNBS**                 | knbs.or.ke        | Economic Survey, Statistical Abstract, GDP, CPI, population          | Annual (May/Dec) + quarterly          |
| **Central Bank**         | centralbank.go.ke | Public debt statistics, monetary policy reports                      | Monthly                               |
| **CRA**                  | cra.go.ke         | Revenue allocation (DORA/CARA), county revenue monitoring            | Annual (Feb) + quarterly              |
| **Kenya Open Data**      | opendata.go.ke    | Machine-readable datasets (CKAN API)                                 | Continuous                            |
| **IFMIS**                | ifmis.go.ke       | Real-time government expenditure (restricted access)                 | Real-time                             |
| **Parliament**           | parliament.go.ke  | Budget estimates, appropriation bills, committee reports             | Session-based                         |

---

## Appendix: Kenya's 47 County Coordinates (for GAP 1.1)

These are approximate centroids needed to fix the map:

| #   | County          | Latitude | Longitude |
| --- | --------------- | -------- | --------- |
| 1   | Mombasa         | -4.0435  | 39.6682   |
| 2   | Kwale           | -4.1816  | 39.4521   |
| 3   | Kilifi          | -3.5107  | 39.9093   |
| 4   | Tana River      | -1.8000  | 40.0000   |
| 5   | Lamu            | -2.2717  | 40.9020   |
| 6   | Taita Taveta    | -3.3160  | 38.4850   |
| 7   | Garissa         | -0.4532  | 39.6461   |
| 8   | Wajir           | 1.7471   | 40.0573   |
| 9   | Mandera         | 3.9373   | 41.8569   |
| 10  | Marsabit        | 2.3284   | 37.9910   |
| 11  | Isiolo          | 0.3546   | 37.5822   |
| 12  | Meru            | 0.0480   | 37.6490   |
| 13  | Tharaka Nithi   | -0.3000  | 37.8500   |
| 14  | Embu            | -0.5389  | 37.4596   |
| 15  | Kitui           | -1.3700  | 38.0106   |
| 16  | Machakos        | -1.5177  | 37.2634   |
| 17  | Makueni         | -1.8000  | 37.6200   |
| 18  | Nyandarua       | -0.1804  | 36.5230   |
| 19  | Nyeri           | -0.4197  | 36.9510   |
| 20  | Kirinyaga       | -0.6591  | 37.3827   |
| 21  | Murang'a        | -0.7840  | 37.0400   |
| 22  | Kiambu          | -1.1714  | 36.8354   |
| 23  | Turkana         | 3.3122   | 35.5658   |
| 24  | West Pokot      | 1.6210   | 35.1190   |
| 25  | Samburu         | 1.2154   | 36.9541   |
| 26  | Trans Nzoia     | 1.0567   | 34.9507   |
| 27  | Uasin Gishu     | 0.5143   | 35.2698   |
| 28  | Elgeyo Marakwet | 0.7800   | 35.5100   |
| 29  | Nandi           | 0.1836   | 35.1270   |
| 30  | Baringo         | 0.4912   | 35.9430   |
| 31  | Laikipia        | 0.3606   | 36.7820   |
| 32  | Nakuru          | -0.3031  | 36.0800   |
| 33  | Narok           | -1.0876  | 35.8600   |
| 34  | Kajiado         | -2.0981  | 36.7819   |
| 35  | Kericho         | -0.3692  | 35.2863   |
| 36  | Bomet           | -0.7813  | 35.3420   |
| 37  | Kakamega        | 0.2827   | 34.7519   |
| 38  | Vihiga          | 0.0839   | 34.7075   |
| 39  | Bungoma         | 0.5635   | 34.5608   |
| 40  | Busia           | 0.4347   | 34.1113   |
| 41  | Siaya           | -0.0617  | 34.2422   |
| 42  | Kisumu          | -0.1022  | 34.7617   |
| 43  | Homa Bay        | -0.5273  | 34.4571   |
| 44  | Migori          | -1.0634  | 34.4731   |
| 45  | Kisii           | -0.6813  | 34.7668   |
| 46  | Nyamira         | -0.5633  | 34.9345   |
| 47  | Nairobi         | -1.2921  | 36.8219   |

---

_This document is the source of truth for what needs to be fixed before the app can be considered production-ready. Update status markers as items are completed._
