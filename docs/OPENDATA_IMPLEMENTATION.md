# Open Data Portal Integration - Implementation Notes

## Overview

Task 2.2 aims to integrate Kenya Open Data Portal (opendata.go.ke) as a data source for revenue, budget, project, and procurement datasets.

## Current Status

- **OpenDataExtractor**: ✅ Complete (600 lines, CKAN API v3 integration)
- **Network Access**: ❌ BLOCKED - opendata.go.ke not accessible (connection timeout)
- **Testing**: ⏸️ On hold until portal is accessible

## Implementation Complete

### 1. OpenDataExtractor (`extractors/government/opendata_extractor.py`)

**Features**:

- CKAN API v3 client with session management
- Generic search with tag/organization filtering
- 4 discovery methods for different data types
- Resource filtering (CSV, Excel, JSON, XML)
- Streaming file download
- Comprehensive error handling and logging

**API Methods**:

```python
# Generic search
search_datasets(query, tags, org, limit) -> List[Dict]

# Specific dataset
get_dataset_details(dataset_id) -> Dict

# Discovery methods (4 types)
discover_revenue_data() -> List[Dict]    # Revenue/tax data
discover_budget_data() -> List[Dict]     # Budget allocations
discover_project_data() -> List[Dict]    # Development projects
discover_procurement_data() -> List[Dict] # Tenders/contracts

# Combined discovery
discover_all_datasets() -> List[Dict]

# Download
download_resource(url, filepath) -> Optional[str]
```

**Discovery Strategy**:

- Multiple keyword searches per data type (6 keywords × 4 types = 24 searches)
- Tag-based filtering: `fq: tags:revenue OR tags:finance`
- Organization filtering: `fq: organization:county-government`
- Deduplication by dataset ID
- Filters to downloadable formats only

**Metadata Returned**:

```python
{
    'dataset_id': 'unique-id',
    'title': 'Dataset Name',
    'url': 'https://opendata.go.ke/...',
    'format': 'csv|xlsx|json|xml',
    'size': 12345,
    'last_modified': '2024-01-15',
    'type': 'revenue|budget|project|procurement'
}
```

## Remaining Work (When Portal is Accessible)

### 2. OpenDataParser (`etl/opendata_parser.py`) - NOT STARTED

**Estimated Time**: 2 hours

**Requirements**:

- Parse CSV/Excel revenue data (pandas)
- Parse budget allocation spreadsheets (openpyxl)
- Parse project data (CSV/JSON)
- Parse procurement contracts (Excel/CSV)
- County name normalization (47 counties)
- Fiscal year extraction from filenames/metadata
- Currency parsing (KES amounts)
- Data validation and cleaning

**Interface**:

```python
class OpenDataParser:
    def parse_revenue_data(file_path, metadata) -> List[Dict]:
        """Parse revenue data from CSV/Excel"""
        # Extract: county, fiscal_year, revenue_stream, amount

    def parse_budget_data(file_path, metadata) -> List[Dict]:
        """Parse budget allocation data"""
        # Extract: county, fiscal_year, department, vote, amount

    def parse_project_data(file_path, metadata) -> List[Dict]:
        """Parse development project data"""
        # Extract: county, project_name, category, budget, expenditure

    def parse_procurement_data(file_path, metadata) -> List[Dict]:
        """Parse procurement contract data"""
        # Extract: county, tender_no, supplier, amount, award_date
```

### 3. Database Migration (`backend/migrations/add_opendata_tables.py`) - NOT STARTED

**Estimated Time**: 30 minutes

**Tables to Create**:

```sql
-- Revenue data from Open Data Portal
CREATE TABLE revenue_data (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id),
    fiscal_period_id INTEGER REFERENCES fiscal_periods(id),
    revenue_stream VARCHAR(100),  -- Property tax, business permits, etc.
    budgeted_amount DECIMAL(15,2),
    actual_amount DECIMAL(15,2),
    collection_rate DECIMAL(5,2),  -- actual/budgeted %
    source_document_id INTEGER REFERENCES source_documents(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Development projects
CREATE TABLE development_projects (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id),
    fiscal_period_id INTEGER REFERENCES fiscal_periods(id),
    project_name VARCHAR(200),
    category VARCHAR(100),  -- Roads, Health, Water, Education
    budgeted_amount DECIMAL(15,2),
    expenditure DECIMAL(15,2),
    status VARCHAR(50),  -- Ongoing, Completed, Stalled
    start_date DATE,
    completion_date DATE,
    source_document_id INTEGER REFERENCES source_documents(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Procurement contracts
CREATE TABLE procurement_contracts (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id),
    tender_number VARCHAR(50),
    description TEXT,
    supplier_name VARCHAR(200),
    contract_value DECIMAL(15,2),
    award_date DATE,
    contract_type VARCHAR(50),  -- Goods, Services, Works
    source_document_id INTEGER REFERENCES source_documents(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_revenue_entity ON revenue_data(entity_id);
CREATE INDEX idx_revenue_fiscal ON revenue_data(fiscal_period_id);
CREATE INDEX idx_projects_entity ON development_projects(entity_id);
CREATE INDEX idx_procurement_entity ON procurement_contracts(entity_id);
```

### 4. Pipeline Integration (`etl/kenya_pipeline.py`) - NOT STARTED

**Estimated Time**: 30 minutes

**Changes Required**:

1. Add `_discover_opendata()` method:

```python
def _discover_opendata(self) -> List[Dict]:
    """Discover Open Data Portal datasets"""
    extractor = OpenDataExtractor()
    datasets = extractor.discover_all_datasets()
    return [{
        'url': ds['url'],
        'title': ds['title'],
        'format': ds['format'],
        'type': ds['type'],
        'metadata': ds,
    } for ds in datasets]
```

2. Add to `discover_budget_documents()`:

```python
elif source_key == "opendata":
    discovered_docs.extend(self._discover_opendata())
```

3. Add parsing logic:

```python
def _process_opendata_document(self, doc_info):
    """Process Open Data Portal dataset"""
    parser = OpenDataParser()

    if doc_info['type'] == 'revenue':
        records = parser.parse_revenue_data(file_path, doc_info['metadata'])
        self.db_loader.load_revenue_data(records)
    elif doc_info['type'] == 'budget':
        # ...
```

4. Update smart scheduler configuration:

```python
"opendata": {
    "default": {
        "frequency": "weekly",
        "day": "friday",
        "reason": "Weekly Open Data Portal updates"
    }
}
```

### 5. API Endpoints (`backend/routers/`) - NOT STARTED

**Estimated Time**: 2 hours

**New Routers**:

1. **`backend/routers/revenue.py`**:

```python
@router.get("/api/v1/revenue/counties/{entity_id}")
async def get_county_revenue(entity_id: int, fiscal_year: Optional[int]):
    """Get revenue by stream for a county"""
    # Query revenue_data table
    # Group by revenue_stream
    # Calculate collection rates

@router.get("/api/v1/analytics/budget-vs-revenue/{entity_id}")
async def get_budget_revenue_gap(entity_id: int):
    """Compare budgeted vs actual revenue"""
    # Join budget_lines with revenue_data
    # Calculate gaps and trends
```

2. **`backend/routers/projects.py`**:

```python
@router.get("/api/v1/projects/counties/{entity_id}")
async def get_county_projects(entity_id: int):
    """Get development projects for a county"""
    # Query development_projects table
    # Group by category
    # Calculate completion rates
```

3. **`backend/routers/procurement.py`**:

```python
@router.get("/api/v1/procurement/counties/{entity_id}")
async def get_procurement_contracts(entity_id: int):
    """Get procurement contracts for a county"""
    # Query procurement_contracts table
    # Calculate supplier concentration
    # Identify large contracts
```

## Alternative Approach (If Portal Remains Inaccessible)

### Option 1: Manual Data Curation

- Download key datasets manually when portal is accessible
- Store in `data/opendata/` directory
- Parse offline
- Update quarterly

### Option 2: Alternative Sources

- **Kenya Revenue Authority (KRA)**: Tax revenue data
- **Controller of Budget**: Already integrated (revenue in budget execution reports)
- **County Treasury websites**: Direct budget/revenue documents
- **National Treasury**: IFMIS data portal

### Option 3: API Proxies

- Request API access via email to KNBS
- Use data.gov.ke mirror if available
- Check AfricaOpenData or other aggregators

## Testing Plan (When Portal is Accessible)

### Phase 1: Discovery Test (5 minutes)

```bash
python extractors/government/opendata_extractor.py
# Expected: 50-200 datasets discovered
```

### Phase 2: Sample Download Test (15 minutes)

```bash
python test_opendata_discovery.py
# Download 5 sample datasets (1 per type)
# Verify file integrity
```

### Phase 3: Parser Development (2 hours)

- Examine sample dataset structures
- Build parsers for each format
- Test with real data

### Phase 4: Pipeline Integration (1 hour)

- Add to kenya_pipeline.py
- Run discovery + parse + load
- Verify database records

### Phase 5: API Testing (1 hour)

- Test revenue endpoints
- Test project endpoints
- Test procurement endpoints
- Validate data accuracy

## Next Steps

**Immediate** (Network Issue):

1. ✅ Document approach (this file)
2. ⏳ Monitor KNBS ETL test (running in background)
3. ⏳ Test economic API endpoints when KNBS data loaded
4. ⏳ Validate per-capita calculations with real data

**When Portal is Accessible**:

1. Test OpenDataExtractor discovery (5 min)
2. Download sample datasets (15 min)
3. Build OpenDataParser (2 hours)
4. Create database migration (30 min)
5. Integrate with pipeline (30 min)
6. Build API endpoints (2 hours)
7. End-to-end testing (1 hour)
8. **Total estimated time**: 6-7 hours

## Files Created This Session

- `extractors/government/opendata_extractor.py` (600 lines) - ✅ Complete
- `test_db_connection.py` (150 lines) - ✅ Complete
- `test_knbs_etl.py` (200 lines) - ✅ Complete, running
- `docs/OPENDATA_IMPLEMENTATION.md` (this file) - ✅ Complete

## Files to Create (When Portal is Accessible)

- `etl/opendata_parser.py` (400 lines)
- `backend/migrations/add_opendata_tables.py` (150 lines)
- `backend/routers/revenue.py` (200 lines)
- `backend/routers/projects.py` (150 lines)
- `backend/routers/procurement.py` (150 lines)
- `test_opendata_pipeline.py` (200 lines)

## References

- CKAN API Documentation: https://docs.ckan.org/en/2.10/api/
- Kenya Open Data Portal: https://opendata.go.ke
- KNBS Official Site: https://www.knbs.or.ke

---

**Status**: OpenDataExtractor complete, network blocker prevents testing
**Completion**: 25% (Extractor done, Parser/DB/API pending)
**Blocker**: opendata.go.ke connection timeout
**Workaround**: Focus on KNBS validation, return to Open Data when accessible
