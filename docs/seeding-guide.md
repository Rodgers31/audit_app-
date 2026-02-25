# Database Seeding Guide

Complete guide for seeding the Kenya Audit Transparency application database with real government data.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Environment Configuration](#environment-configuration)
4. [Available Domains](#available-domains)
5. [CLI Usage](#cli-usage)
6. [Data Sources](#data-sources)
7. [Ingestion Job Tracking](#ingestion-job-tracking)
8. [Troubleshooting](#troubleshooting)
9. [Development Workflow](#development-workflow)
10. [Production Deployment](#production-deployment)

## Overview

The seeding system provides a robust ETL (Extract, Transform, Load) pipeline for ingesting government financial and economic data from multiple sources including:

- Controller of Budget (CoB) county budget execution reports
- Office of Auditor-General (OAG) audit findings
- Kenya National Bureau of Statistics (KNBS) population and economic indicators
- National Treasury debt bulletins
- Educational content for the learning hub

### Key Features

- ✅ **Incremental updates** - Only fetch and process new/changed data
- ✅ **Provenance tracking** - Every record traces back to its source
- ✅ **Job observability** - Track execution status, metrics, and errors
- ✅ **Dry-run mode** - Test without committing changes
- ✅ **Rate limiting** - Respectful HTTP client with configurable limits
- ✅ **Retry logic** - Automatic retries for transient failures
- ✅ **Change detection** - Content hashing to avoid duplicate writes

## Quick Start

### Prerequisites

```bash
# Ensure database is running and migrations are applied
cd backend
alembic upgrade head

# Bootstrap reference data (Kenya country + counties)
python bootstrap_data.py
```

### Run Your First Seed

```bash
# Test with dry-run (no database writes)
python -m seeding.cli seed --domain counties_budget --dry-run

# Seed counties budget data for real
python -m seeding.cli seed --domain counties_budget

# Seed all domains
python -m seeding.cli seed --all
```

### Verify Results

```bash
# Check what was seeded
python verify_seeded_data.py

# Check latest budget line with provenance
python check_latest_line.py
```

## Environment Configuration

Configure seeding behavior via environment variables in `backend/.env`:

### Core Settings

```bash
# Rate limiting (requests per time window)
SEED_RATE_LIMIT=60/min              # 60 requests per minute
SEED_TIMEOUT_SECONDS=30.0           # HTTP request timeout
SEED_MAX_RETRIES=3                  # Retry attempts for failures
SEED_DRY_RUN_DEFAULT=false          # Default dry-run behavior

# Currency
SEED_BUDGET_DEFAULT_CURRENCY=KES    # Fallback for missing currency
```

### Data Source URLs

#### Development (Real Data — run from project root)

```bash
SEED_BUDGETS_DATASET_URL=file://backend/seeding/real_data/budgets.json
SEED_AUDITS_DATASET_URL=file://backend/seeding/real_data/audits.json
SEED_POPULATION_DATASET_URL=file://backend/seeding/real_data/population.json
SEED_ECONOMIC_INDICATORS_DATASET_URL=file://backend/seeding/real_data/economic_indicators.json
```

#### Production (Real Government APIs)

```bash
# Controller of Budget - County Budget Implementation Review Reports
SEED_BUDGETS_DATASET_URL=https://opendata.go.ke/api/views/xyz/rows.json

# Office of Auditor-General - Audit Reports
SEED_AUDITS_DATASET_URL=https://oagkenya.go.ke/api/reports/data.json

# KNBS - Population Statistics
SEED_POPULATION_DATASET_URL=https://www.knbs.or.ke/data/population.json

# KNBS - Economic Indicators (CPI, GDP, etc.)
SEED_ECONOMIC_INDICATORS_DATASET_URL=https://www.knbs.or.ke/data/economic-indicators.json
```

### Advanced Settings

```bash
# Logging
SEED_LOG_LEVEL=INFO                           # DEBUG, INFO, WARNING, ERROR
SEED_LOG_PATH=/var/log/seeding/seed.json     # Optional JSON log file

# Storage
SEED_STORAGE_PATH=data/seeding                # Base directory for downloads
SEED_CACHE_PATH=data/seeding/cache            # HTTP response cache
SEED_CACHE_TTL_SECONDS=86400                  # Cache expiry (24 hours)

# HTTP Client
SEED_HTTP_CACHE_ENABLED=true                  # Enable response caching
SEED_HTTP_FOLLOW_REDIRECTS=true               # Follow HTTP redirects
SEED_USER_AGENT=KenyaAuditAppSeeder/1.0       # User agent string
SEED_CONTACT_EMAIL=admin@example.com          # Contact for data providers
```

## Available Domains

| Domain                | Description                  | Tables Populated                                      |
| --------------------- | ---------------------------- | ----------------------------------------------------- |
| `counties_budget`     | County budget execution data | `budget_lines`, `source_documents`, `fiscal_periods`  |
| `audits`              | Audit findings from OAG      | `audits`, `source_documents`                          |
| `population`          | Population statistics        | `population_data`, `source_documents`                 |
| `economic_indicators` | CPI, GDP, unemployment       | `economic_indicators`, `gdp_data`, `source_documents` |
| `national_debt`       | Government debt data         | `loans`, `source_documents`                           |
| `learning_hub`        | Educational Q&A content      | `quick_questions`                                     |

## CLI Usage

The seeding CLI is invoked via Python module:

```bash
python -m seeding.cli seed [OPTIONS]
```

### Options

```
--domain DOMAIN       Seed a specific domain (repeatable)
--all                 Seed all registered domains
--dry-run             Test without committing database changes
--no-dry-run          Force commit (overrides SEED_DRY_RUN_DEFAULT)
--since TIMESTAMP     Only process records after this date (ISO format or YYYY-MM-DD)
--config PATH         Path to .env file (defaults to backend/.env)
```

### Examples

```bash
# Seed one domain
python -m seeding.cli seed --domain counties_budget

# Seed multiple domains
python -m seeding.cli seed --domain population --domain economic_indicators

# Seed all domains
python -m seeding.cli seed --all

# Dry-run (no commits)
python -m seeding.cli seed --domain audits --dry-run

# Incremental update (only new data since date)
python -m seeding.cli seed --domain counties_budget --since 2024-01-01

# Use custom config
python -m seeding.cli seed --all --config /path/to/.env.production
```

### Exit Codes

- `0` - Success
- `1` - Error (domain validation failed, fetch error, database error)

## Data Sources

### Controller of Budget (CoB)

**Base URL:** `https://cob.go.ke/`

**Datasets:**

- County Budget Implementation Review Reports (Quarterly)
- Annual County Budget Execution Reports

**Format:** PDF tables, Excel attachments, structured JSON (if available)

**Update Frequency:** Quarterly

### Office of Auditor-General (OAG)

**Base URL:** `https://oagkenya.go.ke/`

**Datasets:**

- County Audit Reports (Annual)
- Special Audit Reports

**Format:** PDF documents with findings summaries

**Update Frequency:** Annual (September-December)

### Kenya National Bureau of Statistics (KNBS)

**Base URL:** `https://www.knbs.or.ke/`

**Datasets:**

- Population & Housing Census
- Gross County Product (GCP)
- Consumer Price Index (CPI)
- Gross Domestic Product (GDP)
- Unemployment statistics

**Format:** CSV, Excel, JSON APIs

**Update Frequency:**

- Census: Every 10 years
- GCP: Annual
- CPI: Monthly
- GDP: Quarterly

### National Treasury

**Base URL:** `https://treasury.go.ke/`

**Datasets:**

- Public Debt Bulletin (Monthly)
- External Debt Reports

**Format:** PDF, Excel

**Update Frequency:** Monthly

## Ingestion Job Tracking

Every seeding run creates an `IngestionJob` record tracking:

- Domain name
- Execution status (`RUNNING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`)
- Start and finish timestamps
- Items processed, created, updated
- Error messages
- Custom metadata

### Provenance Chain

Each seeded record includes provenance:

```python
# Example budget_lines provenance
[
  {
    "dataset_id": "cob-q3-2024",
    "ingestion_job_id": 42
  }
]
```

This enables:

- Tracking data lineage
- Auditing source reliability
- Rolling back specific ingestion runs
- Debugging data quality issues

### Querying Jobs

```sql
-- Recent jobs
SELECT id, domain, status, started_at, items_created
FROM ingestion_jobs
ORDER BY started_at DESC
LIMIT 10;

-- Failed jobs
SELECT id, domain, errors, started_at
FROM ingestion_jobs
WHERE status = 'FAILED';

-- Jobs for specific domain
SELECT *
FROM ingestion_jobs
WHERE domain = 'counties_budget'
ORDER BY started_at DESC;
```

## Troubleshooting

### Common Issues

#### 1. Domain Not Found

```
ERROR: Unknown domain(s) requested: my_domain
```

**Solution:** Ensure domain is registered in `backend/seeding/registries.py` and `__init__.py` has `@register_domain` decorator.

#### 2. Database Connection Failed

```
ERROR: Database connection failed
```

**Solution:**

- Check `DATABASE_URL` or `DB_*` environment variables
- Ensure PostgreSQL is running
- Verify migrations are applied: `alembic upgrade head`

#### 3. HTTP Fetch Failed

```
ERROR: Failed to fetch budget payload: Connection timeout
```

**Solution:**

- Check data source URL is accessible
- Increase `SEED_TIMEOUT_SECONDS`
- Verify rate limiting isn't too aggressive

#### 4. Entity Not Found

```
WARNING: Unknown entity slug 'xyz-county'
```

**Solution:** Run `python bootstrap_data.py` to seed reference entities.

#### 5. Enum Type Already Exists

```
ERROR: type "ingestionstatus" already exists
```

**Solution:** Migration tries to create existing enum. Already handled in migration code with existence checks.

### Debug Mode

Enable detailed logging:

```bash
SEED_LOG_LEVEL=DEBUG python -m seeding.cli seed --domain counties_budget
```

### Manual Rollback

If an ingestion creates bad data:

```sql
-- Find job ID
SELECT id FROM ingestion_jobs WHERE domain = 'counties_budget' ORDER BY created_at DESC LIMIT 1;

-- Delete records linked to that job (check provenance)
DELETE FROM budget_lines
WHERE provenance @> '[{"ingestion_job_id": 42}]'::jsonb;

-- Mark job as failed
UPDATE ingestion_jobs SET status = 'FAILED' WHERE id = 42;
```

## Development Workflow

### Adding a New Domain

1. Create domain directory:

   ```bash
   mkdir -p backend/seeding/domains/my_domain
   ```

2. Add required modules:
   - `fetcher.py` - Fetch raw data from source
   - `parser.py` - Normalize to domain models
   - `writer.py` - Persist to database
   - `__init__.py` - Register with `@register_domain("my_domain")`

3. Add fixture for testing:

   ```bash
   echo '{"records": [...]}' > backend/seeding/fixtures/my_domain.json
   ```

4. Test:
   ```bash
   python -m seeding.cli seed --domain my_domain --dry-run
   ```

### Testing with Fixtures

Local fixtures enable offline development:

```bash
# Point to local fixture
export SEED_MY_DOMAIN_DATASET_URL=file:///path/to/fixture.json

# Test
python -m seeding.cli seed --domain my_domain --dry-run
```

### Idempotency Testing

Run seeding twice - should not create duplicates:

```bash
python -m seeding.cli seed --domain counties_budget
python -m seeding.cli seed --domain counties_budget

# Verify: items_created should be > 0 first time, 0 second time
```

## Production Deployment

### Scheduled Seeding (GitHub Actions)

See `.github/workflows/seed.yml` for nightly automated seeding.

### Manual Production Run

```bash
# Set production environment
export DATABASE_URL="postgresql://user:pass@prod-db:5432/audit_db"
export SEED_BUDGETS_DATASET_URL="https://..."

# Run all domains
python -m seeding.cli seed --all

# Monitor logs
tail -f /var/log/seeding/seed.json
```

### Monitoring

#### Admin API Endpoints

The backend provides REST API endpoints for monitoring ingestion jobs.

**Authentication Configuration**

By default, admin endpoints are open for development. In production, enable authentication:

```bash
# In production .env
ADMIN_API_AUTH_REQUIRED=true
```

When enabled, endpoints require admin role authentication via JWT bearer token.

**List Ingestion Jobs**

```bash
GET /api/v1/admin/ingestion-jobs

# Query parameters:
# - domain: Filter by domain name (e.g., 'counties_budget', 'audits')
# - status: Filter by status (pending, running, completed, failed, completed_with_errors)
# - days: Number of days to look back (default: 7)
# - page: Page number (default: 1)
# - page_size: Items per page (default: 20, max: 100)

# Example: Get completed jobs from last 30 days
curl "http://localhost:8000/api/v1/admin/ingestion-jobs?status=completed&days=30"
```

**Get Job Details**

```bash
GET /api/v1/admin/ingestion-jobs/{job_id}

# Example: Get details for job #5
curl "http://localhost:8000/api/v1/admin/ingestion-jobs/5"
```

**Get Statistics**

```bash
GET /api/v1/admin/ingestion-jobs/stats/summary?days=30

# Returns:
# - Total jobs by status
# - Total items processed/created/updated
# - Breakdown by domain
```

#### Python Test Script

Use the provided test script to verify all endpoints:

```bash
# Make sure backend is running
python -m uvicorn main:app --reload

# In another terminal:
python test_admin_api.py
```

#### Database Queries

Check `ingestion_jobs` table directly:

```sql
-- Recent jobs
SELECT id, domain, status, started_at, items_processed, items_created
FROM ingestion_jobs
ORDER BY started_at DESC
LIMIT 10;

-- Failed jobs
SELECT id, domain, started_at, errors
FROM ingestion_jobs
WHERE status = 'FAILED'
ORDER BY started_at DESC;

-- Success rate by domain
SELECT domain,
       COUNT(*) as total_runs,
       COUNT(*) FILTER (WHERE status = 'COMPLETED') as successful,
       ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'COMPLETED') / COUNT(*), 2) as success_rate
FROM ingestion_jobs
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY domain;
```

#### Monitoring Setup

- Set up alerts for `status = 'FAILED'`
- Monitor `items_created` and `items_updated` trends
- Track execution duration for performance regression
- Configure Prometheus/Grafana for metrics visualization
- Set up PagerDuty/Slack notifications for critical failures

### Backup Before Seeding

```bash
# Backup database before major seeding run
pg_dump audit_db > backup_$(date +%Y%m%d).sql

# Seed
python -m seeding.cli seed --all

# Restore if needed
psql audit_db < backup_20241101.sql
```

## Best Practices

1. **Always dry-run first** when testing new data sources
2. **Use incremental `--since`** for large datasets
3. **Monitor ingestion_jobs** for failures
4. **Validate provenance** after each run
5. **Test idempotency** by running twice
6. **Keep fixtures updated** for offline development
7. **Document data source changes** when URLs update
8. **Set conservative rate limits** to respect data providers
9. **Log to files** in production for debugging
10. **Version your fixtures** for reproducible tests

## Support

For issues or questions:

- Check troubleshooting section above
- Review `ingestion_jobs` table for error details
- Enable `DEBUG` logging
- Consult `docs/db-seeding-design.md` for architecture details

---

**Last Updated:** November 1, 2025
**Version:** 1.0.0
