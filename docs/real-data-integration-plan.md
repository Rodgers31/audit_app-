# Real Data Integration Plan

## Current Situation

**Problem**: All 6 seeding domains use test fixture files (fake data) instead of real Kenya government data.

**User Requirement**: Store REAL government data from official sources.

## Real Data Sources Available

### 1. KNBS Documents ✅ VERIFIED

- **Extractor**: `extractors/government/knbs_extractor.py`
- **Status**: Successfully discovers 139 real documents from https://www.knbs.or.ke
- **Document Types**:
  - County Statistical Abstracts (23 documents)
  - Economic Survey (24 documents)
  - Statistical Releases (81 documents)
  - Population reports (3 documents)
  - Poverty reports (2 documents)
  - GDP reports (1 document)
- **Data Available**: Population, economic indicators, county statistics

### 2. Controller of Budget (CoB)

- **Website**: https://cob.go.ke
- **Extractor**: `extractors/county/official_county_budget_extractor.py` (partial)
- **Status**: Website accessible, but specific document extraction needs work
- **Data Available**: County budget implementation reports (quarterly)

### 3. Office of Auditor General (OAG)

- **Website**: https://oagkenya.go.ke
- **Extractor**: `extractors/government/oag_audit_extractor.py`
- **Data Available**: Audit reports for counties and national entities

### 4. National Treasury

- **Website**: https://treasury.go.ke
- **Extractor**: `extractors/county/official_county_budget_extractor.py` (partial)
- **Data Available**: National budget documents, county allocations, debt bulletins

### 5. Kenya Open Data Portal

- **Website**: https://www.opendata.go.ke
- **Status**: Portal exists but doesn't use standard Socrata API
- **Note**: Needs investigation for actual data access methods

## Integration Strategy

### Phase 1: Use KNBS Data (IMMEDIATE) ✅

KNBS has the most accessible and structured real data. Priority: Population and economic indicators.

**Steps**:

1. ✅ Verify KNBS extractor can discover documents (DONE - 139 documents found)
2. 🔄 Enhance KNBS extractor to parse PDFs and extract structured data
3. Map KNBS data to seeding domains:
   - **Population domain** ← County Statistical Abstracts
   - **Economic Indicators domain** ← Economic Survey, GDP reports, CPI releases

**Implementation**:

```python
# backend/seeding/domains/population/fetcher.py
from extractors.government.knbs_extractor import KNBSExtractor

def fetch_real_population_data():
    extractor = KNBSExtractor()
    documents = extractor.discover_documents()

    # Filter county statistical abstracts
    county_docs = [d for d in documents if d['type'] == 'county_statistical_abstract']

    # Download and parse PDFs using our PDF parsers
    population_data = []
    for doc in county_docs:
        pdf_data = download_pdf(doc['url'])
        parsed = parse_population_from_pdf(pdf_data)
        population_data.append(parsed)

    return population_data
```

### Phase 2: Use CoB PDFs (NEXT PRIORITY)

CoB quarterly reports contain actual county budget execution data.

**Steps**:

1. Enhance `extractors/cob/*` to discover CoB PDFs
2. Use `backend/seeding/pdf_parsers.py` → `CoBQuarterlyReportParser` (already implemented and tested!)
3. Map to counties_budget domain

**Example**:

```python
# backend/seeding/domains/counties_budget/fetcher.py
from extractors.cob.robust_cob_extractor import RobustCoBExtractor
from backend.seeding.pdf_parsers import CoBQuarterlyReportParser

def fetch_real_budget_data():
    # Discover CoB PDFs
    cob = RobustCoBExtractor()
    reports = cob.extract_reports_from_accessible_urls()

    # Parse PDFs
    parser = CoBQuarterlyReportParser()
    budget_data = []
    for report in reports:
        pdf_path = download_pdf(report['url'])
        parsed = parser.parse_pdf(pdf_path)
        budget_data.extend(parsed['county_budgets'])

    return budget_data
```

### Phase 3: Use OAG Audit Reports

OAG has audit findings for all counties.

**Steps**:

1. Enhance `extractors/government/oag_audit_extractor.py`
2. Use `backend/seeding/pdf_parsers.py` → `OAGAuditReportParser` (already implemented!)
3. Map to audits domain

### Phase 4: National Debt from Treasury

Treasury publishes debt bulletins.

**Steps**:

1. Extract Treasury debt bulletins
2. Use `backend/seeding/pdf_parsers.py` → `TreasuryDebtBulletinParser` (already implemented!)
3. Map to national_debt domain

### Phase 5: Learning Hub Content

Can be manually curated or extracted from government learning resources.

**Option**: Keep this as fixture data initially since it's educational content, not financial data.

## Recommended Action Plan

### Week 1: KNBS Population & Economic Data

**Day 1-2**: Enhance KNBS Extractor

- ✅ Verify document discovery (DONE)
- Add PDF download functionality
- Parse population from County Statistical Abstracts

**Day 3-4**: Integrate with Seeding

- Update `population` domain fetcher to use KNBS data
- Update `economic_indicators` domain fetcher to use KNBS data
- Test seeding with real data

**Day 5**: Verify & Test

- Seed database with real KNBS data
- Verify API endpoints return real population/economic data
- Check frontend displays correct data

### Week 2: CoB Budget Data

**Day 1-2**: CoB PDF Discovery

- Enhance CoB extractor to reliably find PDF URLs
- Download Q3 and Q4 2024 reports

**Day 3-4**: Parse and Integrate

- Use `CoBQuarterlyReportParser` to extract budget tables
- Map to counties_budget domain
- Test seeding

**Day 5**: Verify

- Check all 47 counties have budget data
- Verify API endpoints work
- Test frontend budget displays

### Week 3: OAG Audits & Treasury Debt

- Integrate OAG audit data
- Integrate Treasury debt bulletins
- End-to-end testing with all real data

## Configuration Changes Needed

### Current (Real Data):

```env
SEED_BUDGETS_DATASET_URL=file://backend/seeding/real_data/budgets.json
SEED_AUDITS_DATASET_URL=file://backend/seeding/real_data/audits.json
# ... all domains now use real_data/ (except pending_bills & learning_hub)
```

### Target (Real Data):

```env
# Phase 1: KNBS data via extractor
SEED_POPULATION_SOURCE=knbs_extractor
SEED_ECONOMIC_INDICATORS_SOURCE=knbs_extractor

# Phase 2: CoB PDFs
SEED_BUDGETS_SOURCE=cob_pdf_parser
SEED_BUDGETS_PDF_URLS=https://cob.go.ke/reports/2024-q3.pdf,https://cob.go.ke/reports/2024-q4.pdf

# Phase 3: OAG PDFs
SEED_AUDITS_SOURCE=oag_pdf_parser

# Phase 4: Treasury PDFs
SEED_NATIONAL_DEBT_SOURCE=treasury_pdf_parser

# Phase 5: Curated content (can keep as fixture)
SEED_LEARNING_HUB_SOURCE=fixture
```

## Alternative: Direct API Integration

If government sites offer APIs (not yet verified for Kenya):

```python
# Example if Kenya Open Data Portal has working API
SEED_POPULATION_DATASET_URL=https://www.opendata.go.ke/resource/DATASET-ID.json
```

**Status**: Needs investigation - initial API tests failed, portal may use custom format.

## Success Criteria

✅ Real data integrated when:

1. Database contains actual county names from KNBS census
2. Budget figures match CoB quarterly reports
3. Audit findings come from OAG PDFs
4. Population data matches KNBS County Statistical Abstracts
5. No fixture files used for financial/population data
6. Frontend displays verifiable government data

## Next Immediate Steps

1. ✅ Run KNBS extractor and verify document discovery (DONE - 139 documents)
2. 🔄 **CURRENT**: Add PDF download capability to KNBS extractor
3. Parse population data from County Statistical Abstracts
4. Test seeding one county with real data
5. Expand to all 47 counties

## Notes

- **PDF Parsers**: Already implemented and tested (23/23 passing tests)
- **Seeding Infrastructure**: Already works, just needs real data sources
- **API Endpoints**: 1/8 updated to query database
- **User Requirement**: NO test fixtures for government data

## Risk: Data Availability

**Reality Check**: Government websites may have:

- Inconsistent data formats
- Missing recent data
- PDF-only data (no structured APIs)
- Broken links or moved documents

**Mitigation**:

1. Start with most reliable source (KNBS - already verified working)
2. Build robust PDF parsing (already done!)
3. Use estimates as fallback with clear "needs_verification" flag
4. Document data quality in database metadata
5. Allow manual data corrections via admin interface

**Important**: It's better to have **documented estimates** marked "needs verification" than to claim fixture data is real government data.
