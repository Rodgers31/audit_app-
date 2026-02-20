# Production Data Sources Configuration Guide

This guide explains how to transition from fixture-based seeding to production government data sources.

## Current Status (Development)

All domains currently use local fixture files:

```bash
SEED_BUDGETS_DATASET_URL=file:///c:/Users/rodge/projects/audit_app/backend/seeding/fixtures/budgets.json
SEED_AUDITS_DATASET_URL=file:///c:/Users/rodge/projects/audit_app/backend/seeding/fixtures/audits.json
SEED_POPULATION_DATASET_URL=file:///c:/Users/rodge/projects/audit_app/backend/seeding/fixtures/population.json
SEED_ECONOMIC_INDICATORS_DATASET_URL=file:///c:/Users/rodge/projects/audit_app/backend/seeding/fixtures/economic_indicators.json
SEED_NATIONAL_DEBT_DATASET_URL=file:///c:/Users/rodge/projects/audit_app/backend/seeding/fixtures/national_debt.json
SEED_LEARNING_HUB_DATASET_URL=file:///c:/Users/rodge/projects/audit_app/backend/seeding/fixtures/learning_hub.json
```

## Transition Plan

### Phase 1: Kenya Open Data Portal (JSON/CSV APIs) ✅ RECOMMENDED FIRST

Kenya's Open Data portal uses the Socrata platform, which provides well-documented REST APIs.

#### Step 1: Identify Dataset IDs

Browse https://www.opendata.go.ke/ and find relevant datasets:

**For County Budgets:**

- Search for "county budget" or "CARA" (County Allocation of Revenue Act)
- Look for datasets with budget allocations by county
- Note the dataset ID (visible in URL: `/d/xxxx-yyyy`)

**For Population Data:**

- Search for "census" or "population by county"
- Kenya 2019 census data should be available
- Note the dataset ID

**For Economic Indicators:**

- Search for "GDP", "inflation", "CPI"
- KNBS economic survey data
- Note the dataset ID

#### Step 2: Construct API URLs

Socrata API pattern:

```
https://www.opendata.go.ke/resource/{dataset-id}.json
```

Optional query parameters:

- `$limit=1000` - Return up to 1000 rows
- `$offset=0` - Pagination offset
- `$where=year='2024'` - Filter data
- `$select=county,amount` - Select specific columns
- `$order=county ASC` - Sort results

Example:

```bash
# If dataset ID is abcd-1234
SEED_BUDGETS_DATASET_URL=https://www.opendata.go.ke/resource/abcd-1234.json?$limit=1000
```

#### Step 3: Update Fetchers

The existing fetchers in `backend/seeding/domains/*/fetcher.py` already support HTTP URLs. Just update the `.env` file:

```bash
# In backend/.env
SEED_BUDGETS_DATASET_URL=https://www.opendata.go.ke/resource/YOUR-DATASET-ID.json
```

#### Step 4: Test Connectivity

```bash
# Test if URL is accessible
curl "https://www.opendata.go.ke/resource/YOUR-DATASET-ID.json?$limit=5"

# Should return JSON array of records
```

#### Step 5: Update Parser

The parser may need adjustments based on actual API schema:

```python
# Example: If Open Data has different field names
# In backend/seeding/domains/counties_budget/parser.py

@dataclass
class BudgetRecord:
    county_name: str
    fiscal_year: str
    allocated_amount: Decimal

    @classmethod
    def from_opendata_record(cls, record: Dict[str, Any]) -> "BudgetRecord":
        """Parse Open Data Portal record format."""
        return cls(
            county_name=record.get("county") or record.get("county_name"),
            fiscal_year=record.get("fy") or record.get("fiscal_year"),
            allocated_amount=Decimal(record.get("amount", 0))
        )
```

#### Step 6: Dry-Run Test

```bash
cd backend
python -m seeding.cli seed --domain counties_budget --dry-run
```

Review logs for parsing errors and adjust accordingly.

### Phase 2: Direct Government APIs (If Available)

Some agencies may provide their own APIs:

#### Controller of Budget API (if available)

```bash
# Check if CoB has an API endpoint
SEED_BUDGETS_DATASET_URL=https://cob.go.ke/api/v1/budget-execution?format=json

# May require API key
SEED_COB_API_KEY=your-api-key-here
```

Update fetcher to include API key:

```python
# In fetcher.py
headers = {
    **config.default_headers,
    "X-API-Key": os.getenv("SEED_COB_API_KEY", "")
}
```

#### KNBS API (if available)

```bash
SEED_POPULATION_DATASET_URL=https://www.knbs.or.ke/api/census/2019/population
SEED_ECONOMIC_INDICATORS_DATASET_URL=https://www.knbs.or.ke/api/economic-survey/latest
```

#### OAG API (if available)

```bash
SEED_AUDITS_DATASET_URL=https://oagkenya.go.ke/api/reports?type=county&year=2023
```

#### Treasury API (if available)

```bash
SEED_NATIONAL_DEBT_DATASET_URL=https://treasury.go.ke/api/debt/bulletins/latest
```

### Phase 3: PDF Parsing (Advanced)

For sources that only provide PDFs, implement document parsers.

#### Install PDF Parsing Dependencies

```bash
cd backend
pip install pdfplumber pypdf tabula-py
```

Update `requirements.txt`:

```
pdfplumber==0.10.3
pypdf==3.17.1
tabula-py==2.9.0  # Optional: Java-based table extraction
```

#### Implement CoB Quarterly Report Parser

Create `backend/seeding/parsers/cob_pdf_parser.py`:

```python
"""Parser for Controller of Budget quarterly PDF reports."""

import pdfplumber
from pathlib import Path
from typing import List, Dict, Any
import re

def extract_budget_tables(pdf_path: Path) -> List[Dict[str, Any]]:
    """
    Extract budget execution tables from CoB quarterly report.

    Returns list of records with structure:
    {
        "county": "Nairobi",
        "allocated": 1500000000,
        "absorbed": 1200000000,
        "absorption_rate": 80.0,
        "quarter": "Q2",
        "fiscal_year": "2023/24"
    }
    """
    records = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # Extract tables from page
            tables = page.extract_tables()

            for table in tables:
                # Skip header rows
                header_row = table[0]

                # Check if this looks like a budget table
                if any("county" in str(cell).lower() for cell in header_row):
                    for row in table[1:]:  # Skip header
                        if row and len(row) >= 4:
                            try:
                                record = {
                                    "county": row[0].strip(),
                                    "allocated": parse_currency(row[1]),
                                    "absorbed": parse_currency(row[2]),
                                    "absorption_rate": float(row[3].replace("%", "")),
                                }
                                records.append(record)
                            except (ValueError, IndexError):
                                continue

    return records

def parse_currency(value: str) -> float:
    """Parse currency string to float (e.g., '1,234,567.89' -> 1234567.89)."""
    return float(value.replace(",", "").replace("KES", "").strip())
```

#### Update Fetcher to Download PDFs

```python
# In fetcher.py
async def fetch_cob_quarterly_report(url: str, cache_dir: Path) -> Path:
    """Download CoB PDF report and return local path."""
    response = await http_client.get(url)
    response.raise_for_status()

    # Save PDF to cache
    pdf_filename = url.split("/")[-1]
    pdf_path = cache_dir / pdf_filename

    with open(pdf_path, "wb") as f:
        f.write(response.content)

    return pdf_path
```

#### Update Domain to Use PDF Parser

```python
# In counties_budget/__init__.py
from ..parsers.cob_pdf_parser import extract_budget_tables

async def run_counties_budget_domain(session: AsyncSession, config: SeedingSettings, dry_run: bool) -> DomainRunResult:
    """Seed counties budget from CoB quarterly reports."""

    # Fetch PDF
    pdf_url = config.budgets_dataset_url
    pdf_path = await fetch_cob_quarterly_report(pdf_url, config.cache_path)

    # Parse PDF to records
    raw_records = extract_budget_tables(pdf_path)
    budget_records = [BudgetRecord.from_dict(r) for r in raw_records]

    # Write to database
    result = await write_budgets(session, budget_records)

    return result
```

### Phase 4: Web Scraping (Last Resort)

If no API or structured data is available, implement web scrapers.

#### Install Scraping Dependencies

```bash
pip install beautifulsoup4 lxml playwright
playwright install chromium
```

#### Example: Scrape CoB Reports Page

```python
"""Web scraper for CoB reports listing."""

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from typing import List, Dict

async def scrape_cob_reports() -> List[Dict[str, str]]:
    """
    Scrape list of quarterly reports from CoB website.

    Returns list of:
    {
        "title": "Q2 FY 2023/24 Budget Implementation Review",
        "url": "https://cob.go.ke/wp-content/uploads/...",
        "published_date": "2024-01-15"
    }
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("https://cob.go.ke/reports/")
        await page.wait_for_selector(".report-item")

        html = await page.content()
        await browser.close()

    soup = BeautifulSoup(html, "lxml")
    reports = []

    for item in soup.select(".report-item"):
        title = item.select_one(".report-title").text.strip()
        url = item.select_one("a")["href"]
        date = item.select_one(".report-date").text.strip()

        reports.append({
            "title": title,
            "url": url,
            "published_date": date
        })

    return reports
```

## Testing Production Sources

### 1. Connectivity Test

```bash
# Test URL accessibility
python -c "
import requests
url = 'https://www.opendata.go.ke/resource/YOUR-ID.json'
r = requests.get(url, timeout=10)
print(f'Status: {r.status_code}')
print(f'Content-Type: {r.headers.get(\"Content-Type\")}')
print(f'Sample: {r.json()[:2]}')
"
```

### 2. Schema Validation

```bash
# Check if response matches expected schema
cd backend
python -m seeding.cli seed --domain counties_budget --dry-run
```

Review logs for parsing errors.

### 3. Data Quality Check

```python
# In parser.py, add validation
def validate_budget_record(record: BudgetRecord) -> bool:
    """Validate budget record data quality."""
    if not record.county_name or len(record.county_name) < 3:
        logger.warning(f"Invalid county name: {record.county_name}")
        return False

    if record.allocated_amount <= 0:
        logger.warning(f"Invalid allocated amount: {record.allocated_amount}")
        return False

    if not re.match(r'^\d{4}/\d{2,4}$', record.fiscal_year):
        logger.warning(f"Invalid fiscal year format: {record.fiscal_year}")
        return False

    return True
```

### 4. Incremental Updates

Only fetch new/changed data:

```python
# Check last successful run
last_run = session.query(SeedingJob)\
    .filter(SeedingJob.domain == "counties_budget")\
    .filter(SeedingJob.status == "completed")\
    .order_by(SeedingJob.finished_at.desc())\
    .first()

if last_run:
    # Fetch only records newer than last run
    url = f"{base_url}?$where=updated_at > '{last_run.finished_at.isoformat()}'"
```

## Monitoring Production Sources

### 1. Track Fetch Success Rate

```python
# Log metrics after each domain run
logger.info(
    "Domain run metrics",
    extra={
        "domain": "counties_budget",
        "fetch_duration_ms": fetch_duration * 1000,
        "parse_success_rate": records_parsed / records_fetched,
        "write_success_rate": records_written / records_parsed,
    }
)
```

### 2. Alert on Failures

```python
# In CLI or admin API
if result.error_count > 0:
    send_alert(
        subject=f"Seeding errors in {domain}",
        message=f"{result.error_count} errors occurred. Check logs.",
        errors=result.errors
    )
```

### 3. Schedule Regular Updates

```yaml
# In .github/workflows/seed-data.yml
on:
  schedule:
    # Run daily at 2 AM EAT (UTC+3)
    - cron: '0 23 * * *' # 23:00 UTC = 02:00 EAT
  workflow_dispatch: # Manual trigger
```

## Rollback Strategy

If production source fails, automatically fallback to cached data:

```python
async def fetch_with_fallback(url: str, cache_path: Path) -> Dict[str, Any]:
    """Fetch from URL, fallback to cache on failure."""
    try:
        data = await fetch_from_url(url)
        # Save to cache
        with open(cache_path, "w") as f:
            json.dump(data, f)
        return data
    except Exception as e:
        logger.warning(f"Fetch failed, using cache: {e}")
        if cache_path.exists():
            with open(cache_path) as f:
                return json.load(f)
        raise
```

## Production Checklist

Before switching to production sources:

- [ ] Identify actual API endpoints or PDF URLs
- [ ] Test connectivity and authentication
- [ ] Verify data schema matches parser expectations
- [ ] Implement error handling for malformed data
- [ ] Add data quality validation
- [ ] Set up caching for reliability
- [ ] Configure rate limiting to respect API limits
- [ ] Add monitoring and alerting
- [ ] Document any manual data cleaning needed
- [ ] Test incremental updates
- [ ] Set up automated scheduling
- [ ] Have rollback plan ready

## Contact for API Access

If APIs require authentication or are not publicly documented:

- **Kenya Open Data Portal:** opendata@ict.go.ke
- **Controller of Budget:** info@cob.go.ke, IT Department
- **Office of Auditor General:** info@oagkenya.go.ke
- **KNBS:** info@knbs.or.ke, Data Services
- **National Treasury:** info@treasury.go.ke

Request:

1. API documentation
2. Authentication credentials (API keys)
3. Rate limits and usage guidelines
4. Data update frequency
5. Contact for technical support
