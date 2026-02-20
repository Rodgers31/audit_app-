# Task 2.2: Kenya Open Data Portal Integration

**Date**: October 11, 2025  
**Priority**: HIGH  
**Estimated Time**: 8-12 hours  
**Status**: PLANNING

---

## Overview

Integrate Kenya's Open Data Portal (https://opendata.go.ke) to enhance financial transparency data with:

- Revenue collection data
- Development projects
- Public expenditure tracking
- County-level statistics

---

## Research Phase (2 hours)

### Objectives

1. ✅ Identify available datasets relevant to financial transparency
2. ✅ Understand data formats (CSV, JSON, XML, Excel)
3. ✅ Document API availability (CKAN or similar)
4. ✅ Assess data quality and update frequency
5. ✅ Map to existing database schema

---

## Open Data Portal Structure

### Data Portal Technology

**Platform**: Likely CKAN (Comprehensive Knowledge Archive Network)

- Standard for government open data portals
- RESTful API for programmatic access
- Supports multiple data formats
- Metadata-rich datasets

### Expected Datasets (Relevant to Financial Transparency)

#### 1. **Revenue Collection** ⭐ HIGH PRIORITY

- County revenue data (property tax, business permits, etc.)
- National revenue (KRA tax collections)
- Format: CSV, Excel
- Update Frequency: Monthly/Quarterly
- **Use Case**: Compare budgeted vs. actual revenue

#### 2. **County Budgets** ⭐ HIGH PRIORITY

- Detailed county budget allocations
- Department-wise breakdowns
- Format: PDF, Excel, CSV
- Update Frequency: Annual
- **Use Case**: Supplement COB data with more granular breakdowns

#### 3. **Development Projects**

- Infrastructure projects
- Project costs and timelines
- Implementation status
- Format: CSV, JSON
- Update Frequency: Quarterly
- **Use Case**: Track capital expenditure against budgets

#### 4. **Public Procurement**

- Tender awards
- Contract values
- Supplier information
- Format: CSV
- Update Frequency: Monthly
- **Use Case**: Audit procurement against budgets

#### 5. **County Statistics**

- Demographics (supplement KNBS data)
- Economic indicators
- Infrastructure metrics
- Format: CSV, Excel
- **Use Case**: Enhanced per-capita analysis

---

## Technical Architecture

### Components to Build

#### 1. **OpenDataExtractor** (3 hours)

```
extractors/government/opendata_extractor.py
```

**Responsibilities:**

- Discover datasets via CKAN API
- Filter by relevance (financial, budget, revenue)
- Download dataset files
- Handle multiple formats (CSV, Excel, JSON)

**Key Methods:**

```python
class OpenDataExtractor:
    def __init__(self, base_url="https://opendata.go.ke"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/3/action"

    def discover_datasets(self, tags=None, organization=None):
        """Search for datasets by tags/organization"""
        pass

    def get_dataset_metadata(self, dataset_id):
        """Get detailed metadata for a dataset"""
        pass

    def download_resource(self, resource_url, resource_format):
        """Download and parse dataset resource"""
        pass

    def discover_revenue_data(self):
        """Specific discovery for revenue datasets"""
        pass

    def discover_budget_data(self):
        """Specific discovery for budget datasets"""
        pass

    def discover_project_data(self):
        """Specific discovery for project datasets"""
        pass
```

---

#### 2. **OpenDataParser** (3 hours)

```
etl/opendata_parser.py
```

**Responsibilities:**

- Parse CSV files (pandas)
- Parse Excel files (openpyxl)
- Extract JSON data
- Normalize data to common schema
- Handle data quality issues

**Key Methods:**

```python
class OpenDataParser:
    def parse_dataset(self, file_path, dataset_type):
        """Main entry point - routes to specific parser"""
        pass

    def parse_revenue_data(self, df):
        """
        Extract revenue data from CSV/Excel
        Returns: List[RevenueRecord]
        """
        pass

    def parse_budget_data(self, df):
        """
        Extract budget data from CSV/Excel
        Returns: List[BudgetRecord]
        """
        pass

    def parse_project_data(self, df):
        """
        Extract project data from CSV/Excel
        Returns: List[ProjectRecord]
        """
        pass

    def _normalize_county_names(self, county_name):
        """Map various county name formats to standard names"""
        pass

    def _extract_fiscal_year(self, text):
        """Extract fiscal year from various formats"""
        pass
```

---

#### 3. **Database Schema Extensions** (1 hour)

**New Tables:**

```sql
-- Revenue data
CREATE TABLE IF NOT EXISTS revenue_data (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    fiscal_period_id INTEGER REFERENCES fiscal_periods(id),
    revenue_type VARCHAR(100) NOT NULL,  -- property_tax, business_permits, etc.
    budgeted_amount NUMERIC(15, 2),
    actual_amount NUMERIC(15, 2) NOT NULL,
    collection_date DATE,
    source_document_id INTEGER REFERENCES source_documents(id),
    confidence_score NUMERIC(3, 2) DEFAULT 1.0,
    validation_warnings JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_revenue_entity_period ON revenue_data(entity_id, fiscal_period_id);
CREATE INDEX idx_revenue_type ON revenue_data(revenue_type);
CREATE INDEX idx_revenue_date ON revenue_data(collection_date);

-- Development projects
CREATE TABLE IF NOT EXISTS development_projects (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    project_name VARCHAR(500) NOT NULL,
    project_code VARCHAR(100),
    category VARCHAR(100),  -- infrastructure, health, education, etc.
    budgeted_amount NUMERIC(15, 2),
    actual_expenditure NUMERIC(15, 2),
    start_date DATE,
    completion_date DATE,
    status VARCHAR(50),  -- planned, ongoing, completed, stalled
    location TEXT,
    description TEXT,
    source_document_id INTEGER REFERENCES source_documents(id),
    confidence_score NUMERIC(3, 2) DEFAULT 1.0,
    validation_warnings JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_entity ON development_projects(entity_id);
CREATE INDEX idx_projects_status ON development_projects(status);
CREATE INDEX idx_projects_category ON development_projects(category);

-- Procurement contracts
CREATE TABLE IF NOT EXISTS procurement_contracts (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    tender_number VARCHAR(100) NOT NULL,
    contract_title VARCHAR(500) NOT NULL,
    supplier_name VARCHAR(300),
    contract_value NUMERIC(15, 2),
    award_date DATE,
    contract_start DATE,
    contract_end DATE,
    procurement_method VARCHAR(100),  -- open_tender, restricted, direct, etc.
    category VARCHAR(100),
    source_document_id INTEGER REFERENCES source_documents(id),
    confidence_score NUMERIC(3, 2) DEFAULT 1.0,
    validation_warnings JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_procurement_entity ON procurement_contracts(entity_id);
CREATE INDEX idx_procurement_date ON procurement_contracts(award_date);
CREATE INDEX idx_procurement_supplier ON procurement_contracts(supplier_name);
```

---

#### 4. **Pipeline Integration** (2 hours)

**Update `etl/kenya_pipeline.py`:**

```python
def _discover_opendata(self) -> List[Dict]:
    """
    Discover datasets from Kenya Open Data Portal

    Returns:
        List of dataset metadata dicts with:
        - url: Dataset resource URL
        - title: Dataset title
        - format: CSV, Excel, JSON, etc.
        - type: revenue, budget, project, procurement
        - organization: Source organization
        - last_modified: Last update timestamp
    """
    if not self.opendata_extractor:
        return []

    logger.info("🔍 Discovering Open Data Portal datasets...")

    # Discover by category
    revenue_datasets = self.opendata_extractor.discover_revenue_data()
    budget_datasets = self.opendata_extractor.discover_budget_data()
    project_datasets = self.opendata_extractor.discover_project_data()

    all_datasets = revenue_datasets + budget_datasets + project_datasets

    logger.info(f"✅ Discovered {len(all_datasets)} Open Data datasets")
    return all_datasets

def _process_opendata_document(self, doc_metadata: Dict) -> Dict:
    """
    Download and process an Open Data dataset

    Args:
        doc_metadata: Dataset metadata from discovery

    Returns:
        Processing result with extracted data
    """
    # Download dataset
    file_path = self._download_file(doc_metadata['url'])

    # Parse based on type
    dataset_type = doc_metadata['type']
    parsed_data = self.opendata_parser.parse_dataset(file_path, dataset_type)

    # Validate data
    validated_data = self._validate_data(parsed_data, dataset_type)

    # Insert into database
    self._insert_opendata_records(validated_data, dataset_type)

    return {
        'success': True,
        'records_processed': len(validated_data),
        'dataset_type': dataset_type
    }
```

---

#### 5. **API Endpoints** (2 hours)

**New Router: `backend/routers/revenue.py`**

```python
@router.get("/api/v1/revenue/counties/{county_id}")
async def get_county_revenue(
    county_id: int,
    fiscal_year: Optional[str] = None,
    revenue_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get revenue data for a county

    Query Parameters:
    - fiscal_year: Filter by fiscal year (e.g., "2023/2024")
    - revenue_type: Filter by type (property_tax, business_permits, etc.)

    Returns:
    - Revenue streams with budgeted vs. actual amounts
    - Collection rates
    - Trends
    """
    pass

@router.get("/api/v1/projects/counties/{county_id}")
async def get_county_projects(
    county_id: int,
    status: Optional[str] = None,
    category: Optional[str] = None,
    min_budget: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Get development projects for a county

    Query Parameters:
    - status: Filter by status (planned, ongoing, completed)
    - category: Filter by category (infrastructure, health, etc.)
    - min_budget: Minimum budget threshold

    Returns:
    - Project details
    - Budget vs. expenditure
    - Completion status
    """
    pass

@router.get("/api/v1/procurement/counties/{county_id}")
async def get_county_procurement(
    county_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    min_value: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Get procurement contracts for a county

    Query Parameters:
    - start_date: Filter contracts from this date
    - end_date: Filter contracts to this date
    - min_value: Minimum contract value

    Returns:
    - Contract details
    - Supplier information
    - Award dates
    """
    pass

@router.get("/api/v1/analytics/budget-vs-revenue/{county_id}")
async def analyze_budget_revenue_gap(
    county_id: int,
    fiscal_year: str,
    db: Session = Depends(get_db)
):
    """
    Analyze budget vs. revenue for a county

    Returns:
    - Budgeted revenue vs. actual collection
    - Collection rates by revenue stream
    - Deficit/surplus analysis
    - Recommendations
    """
    pass
```

---

## Data Quality Considerations

### Expected Data Quality Issues

1. **Inconsistent County Names**

   - "Nairobi" vs. "Nairobi City County" vs. "Nairobi County"
   - Solution: Fuzzy matching with fuzzywuzzy

2. **Missing Fiscal Years**

   - Datasets may not have explicit fiscal year columns
   - Solution: Extract from file names or metadata

3. **Currency Formatting**

   - "KES 1,234,567" vs. "1234567.00" vs. "1.23M"
   - Solution: Robust currency parsing

4. **Date Formats**

   - "2023/2024" vs. "FY2024" vs. "2023-2024"
   - Solution: Multiple date parsers

5. **Duplicate Records**
   - Same data in multiple datasets
   - Solution: Deduplication by unique keys

---

## Smart Scheduler Configuration

```python
# config/etl_schedule.yaml
opendata:
  source_name: "Kenya Open Data Portal"
  enabled: true
  frequency: "weekly"
  run_on_days: [5]  # Friday
  datasets:
    - revenue_data
    - development_projects
    - procurement_contracts
  retry_on_failure: true
  max_retries: 3
```

---

## Implementation Timeline

### Phase 1: Research & Discovery (2 hours)

- ✅ Document Open Data Portal structure
- ✅ Identify relevant datasets
- ✅ Test API access
- ✅ Map to database schema

### Phase 2: Extractor Development (3 hours)

- [ ] Create OpenDataExtractor class
- [ ] Implement CKAN API client
- [ ] Add dataset discovery methods
- [ ] Test with real datasets

### Phase 3: Parser Development (3 hours)

- [ ] Create OpenDataParser class
- [ ] Implement CSV/Excel/JSON parsers
- [ ] Add data normalization
- [ ] Handle edge cases

### Phase 4: Database Integration (1 hour)

- [ ] Create migration script
- [ ] Add new tables (revenue, projects, procurement)
- [ ] Run migration

### Phase 5: Pipeline Integration (2 hours)

- [ ] Update KenyaDataPipeline
- [ ] Add discovery methods
- [ ] Add processing methods
- [ ] Test end-to-end

### Phase 6: API Development (2 hours)

- [ ] Create revenue router
- [ ] Create projects endpoint
- [ ] Create procurement endpoint
- [ ] Add analytics endpoints

### Phase 7: Testing & Validation (1 hour)

- [ ] Unit tests for extractor
- [ ] Integration tests for pipeline
- [ ] API endpoint tests
- [ ] Data quality validation

**Total Estimated Time**: 14 hours

---

## Success Criteria

1. ✅ **Extractor**: Successfully discovers and downloads Open Data datasets
2. ✅ **Parser**: Accurately extracts data from CSV/Excel/JSON formats
3. ✅ **Database**: New tables populated with validated data
4. ✅ **API**: Revenue, projects, and procurement endpoints return data
5. ✅ **Quality**: >70% confidence scores on extracted data
6. ✅ **Coverage**: At least 40 out of 47 counties have data

---

## Dependencies

- ✅ FastAPI/Pydantic upgraded (Task 1)
- ✅ KNBS integration complete (Task 2.1)
- ⏳ Database migration framework (existing)
- ⏳ Data validation framework (existing)
- ⏳ Smart scheduler (existing)

---

## Risks & Mitigation

| Risk                           | Impact | Mitigation                               |
| ------------------------------ | ------ | ---------------------------------------- |
| API changes breaking extractor | HIGH   | Version API calls, add fallbacks         |
| Inconsistent data formats      | MEDIUM | Robust parsing, multiple format handlers |
| Missing datasets               | MEDIUM | Monitor portal, alert on data gaps       |
| Low data quality               | MEDIUM | Validation framework, confidence scores  |
| API rate limiting              | LOW    | Respect rate limits, add delays          |

---

## Next Steps

1. **Test CKAN API Access** (30 min)

   ```bash
   curl https://opendata.go.ke/api/3/action/package_search?q=revenue
   ```

2. **Create Extractor Skeleton** (1 hour)

3. **Implement Dataset Discovery** (2 hours)

4. **Build Parser for Revenue Data** (2 hours)

5. **Create Database Migration** (30 min)

6. **Test End-to-End** (1 hour)

---

**Start Date**: October 11, 2025  
**Target Completion**: October 13, 2025 (2 days)  
**Owner**: Implementation Team
