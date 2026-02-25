# Kenya Government Data Sources

This document catalogs official data sources for the audit transparency platform.

## Official Government Portals

### 1. Controller of Budget (CoB)

- **Base URL:** https://cob.go.ke
- **Data Type:** Quarterly budget execution reports (PDF)
- **Relevance:** County-level budget absorption, expenditure tracking
- **Update Frequency:** Quarterly
- **Format:** PDF reports with tables
- **Key Reports:**
  - County Budget Implementation Review Reports (CBIR)
  - National Budget Implementation Review Reports (NBIR)
  - Special Reports on Budget Execution
- **Example URLs:**
  - https://cob.go.ke/reports/
  - https://cob.go.ke/county-budget-implementation-review-reports/

### 2. Office of the Auditor General (OAG)

- **Base URL:** https://oagkenya.go.ke
- **Data Type:** Annual audit reports (PDF)
- **Relevance:** County audit findings, financial statement opinions, compliance issues
- **Update Frequency:** Annual (per fiscal year)
- **Format:** PDF reports, structured audit opinions
- **Key Reports:**
  - County Government Audit Reports
  - National Government Audit Reports
  - State Corporations Audit Reports
- **Example URLs:**
  - https://oagkenya.go.ke/index.php/reports/cat_view/3-county-governments
  - https://oagkenya.go.ke/index.php/reports

### 3. Kenya National Bureau of Statistics (KNBS)

- **Base URL:** https://www.knbs.or.ke
- **Data Type:** Population, economic indicators, statistical abstracts
- **Relevance:** Demographic data, GDP, inflation, employment statistics
- **Update Frequency:** Annual census, quarterly economic surveys
- **Format:** PDF reports, Excel datasets, online portal
- **Key Datasets:**
  - Population & Housing Census
  - Economic Surveys
  - Statistical Abstracts
  - Consumer Price Index (CPI)
  - GDP Statistics
- **Example URLs:**
  - https://www.knbs.or.ke/download-statistics/
  - https://www.knbs.or.ke/publications/

### 4. National Treasury

- **Base URL:** https://www.treasury.go.ke
- **Data Type:** National budgets, debt bulletins, fiscal reports
- **Relevance:** National debt, loan data, budget policy statements
- **Update Frequency:** Monthly (debt bulletins), Annual (budgets)
- **Format:** PDF, Excel spreadsheets
- **Key Reports:**
  - Public Debt Management Reports
  - Budget Policy Statements
  - Quarterly Economic and Budgetary Reviews
  - County Allocation of Revenue Act (CARA)
- **Example URLs:**
  - https://www.treasury.go.ke/budget/
  - https://www.treasury.go.ke/public-debt-management-reports/
  - https://www.treasury.go.ke/fiscal-and-budgetary-documents/

### 5. Kenya Open Data Portal

- **Base URL:** https://www.opendata.go.ke
- **Data Type:** Machine-readable datasets (JSON, CSV, XML)
- **Relevance:** Various government datasets in structured formats
- **Update Frequency:** Varies by dataset
- **Format:** JSON, CSV, XML, Excel
- **Key Datasets:**
  - Budget allocations
  - County financial data
  - Economic indicators
- **API Documentation:** https://www.opendata.go.ke/developers
- **Example URLs:**
  - https://www.opendata.go.ke/browse?category=Budget

## Data Source Priority for Implementation

### Phase 1: Foundation (Current)

Using fixture files for all domains:

- ✅ Counties Budget: `backend/seeding/real_data/budgets.json`
- ✅ Audits: `backend/seeding/real_data/audits.json`
- ✅ Population: `backend/seeding/real_data/population.json`
- ✅ Economic Indicators: `backend/seeding/real_data/economic_indicators.json`
- ✅ National Debt: `backend/seeding/real_data/national_debt.json`
- ✅ Learning Hub: `backend/seeding/fixtures/learning_hub.json` _(educational content, no real data source)_

### Phase 2: Open Data API Integration (Recommended Next)

**Kenya Open Data Portal** should be the first production source because:

- Provides machine-readable formats (JSON/CSV)
- Has a documented API
- Requires no PDF parsing
- Reliable uptime and data quality

**Suggested Implementation:**

```bash
# Update .env with Open Data endpoints
SEED_BUDGETS_DATASET_URL=https://www.opendata.go.ke/resource/xyz.json
SEED_POPULATION_DATASET_URL=https://www.opendata.go.ke/resource/abc.json
SEED_ECONOMIC_INDICATORS_DATASET_URL=https://www.opendata.go.ke/resource/def.json
```

### Phase 3: PDF Parsing (Advanced)

Once Open Data sources are integrated, add PDF parsing for:

1. **CoB Quarterly Reports** - Budget execution tables
2. **OAG Audit Reports** - Audit findings and opinions
3. **Treasury Debt Bulletins** - Loan schedules

**Tools Required:**

- `pdfplumber` - Extract tables from PDFs
- `PyPDF2` or `pypdf` - General PDF text extraction
- `tabula-py` - Java-based table extraction (optional)
- `camelot-py` - Advanced table extraction (optional)

## Data Extraction Challenges

### CoB Reports

- **Format:** PDF with embedded tables
- **Challenge:** Table structures vary between reports
- **Solution:** Implement robust table parser with column detection
- **Frequency:** Quarterly (4 reports/year × 47 counties = ~188 reports)

### OAG Reports

- **Format:** Long-form PDF reports (100+ pages)
- **Challenge:** Unstructured text, audit findings in narrative format
- **Solution:** NLP-based extraction, pattern matching for opinions
- **Frequency:** Annual (47 county reports + national reports)

### KNBS Data

- **Format:** Mix of PDF, Excel, online dashboards
- **Challenge:** Multiple formats, some data only in PDF abstracts
- **Solution:** Prioritize CSV/Excel downloads, fallback to PDF parsing
- **Frequency:** Annual (census), Quarterly (economic surveys)

### Treasury Data

- **Format:** PDF and Excel
- **Challenge:** Debt data in complex tables with footnotes
- **Solution:** Excel parsing preferred, PDF as fallback
- **Frequency:** Monthly bulletins, annual reports

## Recommended Data Fetching Strategy

### 1. Use HTTP Caching

All fetchers already implement caching via `config.http_cache_enabled`:

```python
# Cache is enabled by default with 24-hour TTL
config.cache_ttl_seconds = 86400  # 1 day
```

### 2. Respect Rate Limits

Current configuration:

```python
config.rate_limit = "60/min"  # 1 request per second
```

### 3. Handle Failures Gracefully

- Retry transient failures (network errors, timeouts)
- Skip individual records that fail parsing
- Log all errors with provenance tracking
- Return partial results rather than failing entire domain

### 4. Document Parsing

For PDF sources:

```python
import pdfplumber

def extract_tables_from_pdf(pdf_path: str) -> List[Dict]:
    """Extract tables from CoB/OAG PDF reports."""
    tables = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            extracted = page.extract_tables()
            tables.extend(extracted)
    return tables
```

## Next Steps for Production Data Sources

### Immediate (Task 8)

1. ✅ Document all government data sources
2. ⏳ Research exact API endpoints on Kenya Open Data Portal
3. ⏳ Update `.env` files with real URLs
4. ⏳ Test connectivity to each source
5. ⏳ Update `config.py` default URLs

### Short-term (Task 9)

1. Add PDF parsing dependencies
2. Implement CoB quarterly report parser
3. Implement OAG audit report parser
4. Add integration tests for parsers

### Medium-term

1. Integrate Kenya Open Data Portal API
2. Add authentication if required
3. Implement incremental updates (only fetch new data)
4. Add data validation rules

### Long-term

1. Create web scrapers for sources without APIs
2. Add data quality monitoring
3. Implement automated anomaly detection
4. Set up scheduled data refreshes

## Contact Information

For API access or data questions, contact:

- **CoB:** info@cob.go.ke
- **OAG:** info@oagkenya.go.ke
- **KNBS:** info@knbs.or.ke
- **Treasury:** info@treasury.go.ke
- **Open Data:** opendata@ict.go.ke

## License and Attribution

All data from Kenya government sources should be:

- Attributed to the source agency
- Used in compliance with Kenya Open Data License
- Not modified to misrepresent original findings
- Accompanied by source URLs and fetch timestamps

See `backend/models.py` - `SourceDocument` model includes:

- `source_url` - Original document URL
- `published_date` - When data was published
- `fetched_at` - When we downloaded it
- `checksum` - Content hash for change detection
