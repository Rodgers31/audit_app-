# Mock Data Removal Plan

## Overview

This document outlines the strategy for removing mock/fallback data from API endpoints and ensuring all data comes from the seeded database.

## Current State Assessment

The backend currently uses several fallback mechanisms:

1. **In-memory mock data** - Hardcoded JSON responses
2. **Enhanced County Analytics API fallbacks** - When DB queries fail, return computed values
3. **Mock authentication** - Fallback when no proper auth configured
4. **Illustrative values** - Placeholder numbers for missing data

## Seeded Data Available

All domains successfully seeded and tested:

- ✅ **counties_budget** → `CountyBudget` table
- ✅ **audits** → `AuditReport` table
- ✅ **population** → `PopulationStat` table
- ✅ **economic_indicators** → `EconomicIndicator` table
- ✅ **national_debt** → `Loan` table
- ✅ **learning_hub** → `QuickQuestion` table

## Endpoints to Update

### 1. County Endpoints (`/api/counties/`)

**Current:** Falls back to Enhanced County Analytics API
**Target:** Query only from `Entity` table (counties)

```python
# OLD (lines 827-881 in main.py)
@app.get("/api/counties")
async def get_counties(db: AsyncSession = Depends(get_db)):
    try:
        # Try database first
        result = await db.execute(select(Entity).filter(Entity.type == EntityType.COUNTY))
        counties = result.scalars().all()

        if not counties:
            # Fallback to Enhanced API  ← REMOVE THIS
            ...
```

**NEW:**

```python
@app.get("/api/counties")
async def get_counties(db: AsyncSession = Depends(get_db)):
    """Get all counties from database only."""
    result = await db.execute(
        select(Entity)
        .filter(Entity.type == EntityType.COUNTY)
        .order_by(Entity.canonical_name)
    )
    counties = result.scalars().all()

    if not counties:
        raise HTTPException(
            status_code=503,
            detail="No county data available. Run seeding: python -m seeding.cli seed"
        )

    return [{"id": c.id, "name": c.canonical_name, "slug": c.slug} for c in counties]
```

### 2. County Budget Endpoint (`/api/counties/{county_id}/budget`)

**Current:** Falls back to computed values from Enhanced API
**Target:** Query from `CountyBudget` table

```python
# NEW implementation
@app.get("/api/counties/{county_id}/budget")
async def get_county_budget(county_id: int, db: AsyncSession = Depends(get_db)):
    """Get county budget data from seeded budgets."""
    result = await db.execute(
        select(CountyBudget)
        .filter(CountyBudget.entity_id == county_id)
        .order_by(CountyBudget.fiscal_year.desc())
    )
    budgets = result.scalars().all()

    if not budgets:
        raise HTTPException(
            status_code=404,
            detail=f"No budget data for county {county_id}. Seed data with: python -m seeding.cli seed --domain counties_budget"
        )

    return {
        "county_id": county_id,
        "budgets": [
            {
                "fiscal_year": b.fiscal_year,
                "allocated": float(b.allocated_amount),
                "absorbed": float(b.absorbed_amount),
                "absorption_rate": float(b.absorption_rate) if b.absorption_rate else None,
                "currency": b.currency,
            }
            for b in budgets
        ]
    }
```

### 3. County Debt Endpoint (`/api/counties/{county_id}/debt`)

**Current:** Derives from Enhanced API metrics
**Target:** Query from `Loan` table filtering by entity

```python
@app.get("/api/counties/{county_id}/debt")
async def get_county_debt(county_id: int, db: AsyncSession = Depends(get_db)):
    """Get county debt/loans from database."""
    result = await db.execute(
        select(Loan)
        .filter(Loan.entity_id == county_id)
        .order_by(Loan.issue_date.desc())
    )
    loans = result.scalars().all()

    # Calculate totals
    total_outstanding = sum(loan.outstanding_amount for loan in loans)

    return {
        "county_id": county_id,
        "total_outstanding": float(total_outstanding),
        "loans": [
            {
                "lender": loan.lender,
                "principal": float(loan.principal_amount),
                "outstanding": float(loan.outstanding_amount),
                "issue_date": loan.issue_date.isoformat() if loan.issue_date else None,
                "maturity_date": loan.maturity_date.isoformat() if loan.maturity_date else None,
                "currency": loan.currency,
            }
            for loan in loans
        ]
    }
```

### 4. Audit Reports Endpoint (`/api/audits`)

**Current:** Falls back to in-memory filtered data
**Target:** Query from `AuditReport` table

```python
@app.get("/api/audits")
async def get_audits(
    county_id: Optional[int] = None,
    fiscal_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get audit reports from database."""
    query = select(AuditReport)

    if county_id:
        query = query.filter(AuditReport.entity_id == county_id)

    if fiscal_year:
        query = query.filter(AuditReport.fiscal_year == fiscal_year)

    query = query.order_by(AuditReport.fiscal_year.desc())

    result = await db.execute(query)
    audits = result.scalars().all()

    return {
        "count": len(audits),
        "audits": [
            {
                "id": a.id,
                "entity_id": a.entity_id,
                "fiscal_year": a.fiscal_year,
                "opinion": a.opinion,
                "findings_count": len(a.findings) if a.findings else 0,
                "report_url": a.report_url,
            }
            for a in audits
        ]
    }
```

### 5. National Debt Endpoint (`/api/national/debt`)

**Current:** Returns fallback JSON when API fails
**Target:** Query from `Loan` table (national entity)

```python
@app.get("/api/national/debt")
async def get_national_debt(db: AsyncSession = Depends(get_db)):
    """Get national government debt from database."""
    # Get national government entity
    national_entity = await db.execute(
        select(Entity).filter(Entity.type == EntityType.NATIONAL)
    )
    national = national_entity.scalar_one_or_none()

    if not national:
        raise HTTPException(
            status_code=503,
            detail="National government entity not found. Run: python -m seeding.bootstrap"
        )

    # Get all national loans
    result = await db.execute(
        select(Loan)
        .filter(Loan.entity_id == national.id)
        .order_by(Loan.issue_date.desc())
    )
    loans = result.scalars().all()

    # Aggregate by lender type
    multilateral = sum(l.outstanding_amount for l in loans if "World Bank" in l.lender or "IMF" in l.lender or "AfDB" in l.lender)
    bilateral = sum(l.outstanding_amount for l in loans if any(c in l.lender for c in ["China", "France", "Japan"]))
    commercial = sum(l.outstanding_amount for l in loans if "bond" in l.lender.lower())

    return {
        "total_debt": float(sum(l.outstanding_amount for l in loans)),
        "by_type": {
            "multilateral": float(multilateral),
            "bilateral": float(bilateral),
            "commercial": float(commercial),
        },
        "loans": [
            {
                "lender": l.lender,
                "outstanding": float(l.outstanding_amount),
                "currency": l.currency,
            }
            for l in loans
        ],
        "data_source": "Database (seeded)",
    }
```

### 6. Population Endpoint (`/api/population`)

**Current:** May use mock data
**Target:** Query from `PopulationStat` table

```python
@app.get("/api/population")
async def get_population(
    entity_id: Optional[int] = None,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get population statistics from database."""
    query = select(PopulationStat)

    if entity_id:
        query = query.filter(PopulationStat.entity_id == entity_id)

    if year:
        query = query.filter(PopulationStat.year == year)

    query = query.order_by(PopulationStat.year.desc())

    result = await db.execute(query)
    stats = result.scalars().all()

    return {
        "count": len(stats),
        "statistics": [
            {
                "entity_id": s.entity_id,
                "year": s.year,
                "total_population": s.total_population,
                "male": s.male_population,
                "female": s.female_population,
                "urban": s.urban_population,
                "rural": s.rural_population,
            }
            for s in stats
        ]
    }
```

### 7. Economic Indicators Endpoint (`/api/indicators`)

**Current:** May use fallback data
**Target:** Query from `EconomicIndicator` table

```python
@app.get("/api/indicators")
async def get_economic_indicators(
    indicator_type: Optional[str] = None,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get economic indicators from database."""
    query = select(EconomicIndicator)

    if indicator_type:
        query = query.filter(EconomicIndicator.indicator_type == indicator_type)

    if year:
        query = query.filter(EconomicIndicator.year == year)

    query = query.order_by(EconomicIndicator.year.desc())

    result = await db.execute(query)
    indicators = result.scalars().all()

    return {
        "count": len(indicators),
        "indicators": [
            {
                "indicator_type": i.indicator_type,
                "year": i.year,
                "value": float(i.value),
                "unit": i.unit,
            }
            for i in indicators
        ]
    }
```

### 8. Learning Hub Questions Endpoint (`/api/learning/questions`)

**Current:** May use mock questions
**Target:** Query from `QuickQuestion` table

```python
@app.get("/api/learning/questions")
async def get_learning_questions(
    category: Optional[str] = None,
    difficulty: Optional[int] = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """Get educational questions from database."""
    query = select(QuickQuestion).filter(QuickQuestion.is_active == True)

    if category:
        query = query.filter(QuickQuestion.category == category)

    if difficulty:
        query = query.filter(QuickQuestion.difficulty_level == difficulty)

    query = query.limit(limit)

    result = await db.execute(query)
    questions = result.scalars().all()

    return {
        "count": len(questions),
        "questions": [
            {
                "id": q.id,
                "question": q.question_text,
                "options": {
                    "A": q.option_a,
                    "B": q.option_b,
                    "C": q.option_c,
                    "D": q.option_d,
                },
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
                "category": q.category,
                "difficulty": q.difficulty_level,
            }
            for q in questions
        ]
    }
```

## Implementation Strategy

### Phase 1: Identify All Fallback Patterns

- [x] Grep for "fallback", "mock", "MOCK\_" patterns in main.py
- [ ] Document each endpoint and its fallback behavior
- [ ] Map each endpoint to its target seeded table

### Phase 2: Update Endpoints One by One

1. Start with simplest endpoints (single table queries)
   - [ ] `/api/counties` - Entity table
   - [ ] `/api/learning/questions` - QuickQuestion table
2. Medium complexity (single table with filters)

   - [ ] `/api/audits` - AuditReport table
   - [ ] `/api/population` - PopulationStat table
   - [ ] `/api/indicators` - EconomicIndicator table

3. Complex (joins or aggregations)
   - [ ] `/api/counties/{id}/budget` - CountyBudget with Entity
   - [ ] `/api/counties/{id}/debt` - Loan with Entity
   - [ ] `/api/national/debt` - Loan aggregated

### Phase 3: Remove Fallback Code

- [ ] Delete all "Enhanced County Analytics API" fallback calls
- [ ] Remove in-memory mock data constants
- [ ] Update error messages to guide users to seeding commands
- [ ] Add helpful error responses (503 Service Unavailable) when data missing

### Phase 4: Update Tests

- [ ] Update existing tests to use seeded data
- [ ] Add new tests verifying database queries
- [ ] Test error cases (empty database, missing entities)

### Phase 5: Documentation

- [ ] Update API documentation to reflect data sources
- [ ] Add README section on seeding requirements
- [ ] Document how to populate database before starting API

## Error Handling Strategy

When data is missing, return helpful errors:

```python
if not data:
    raise HTTPException(
        status_code=503,
        detail={
            "error": "Data not available",
            "message": "Database has no seeded data for this resource",
            "solution": "Run: python -m seeding.cli seed --domain <domain_name>",
            "available_domains": ["counties_budget", "audits", "population", "economic_indicators", "national_debt", "learning_hub"]
        }
    )
```

## Testing Checklist

Before marking complete:

- [ ] All endpoints return data from database
- [ ] No fallback/mock code remains
- [ ] Appropriate HTTP status codes (404, 503)
- [ ] Helpful error messages guide seeding
- [ ] Tests pass with seeded data
- [ ] Frontend integration works

## Rollout Plan

1. **Development:** Update endpoints one by one, test locally
2. **Testing:** Run full seeding, verify all endpoints return real data
3. **Staging:** Deploy with seeded database, run E2E tests
4. **Production:** Ensure seeding runs before deployment, monitor for errors

## Files to Update

- `backend/main.py` - Remove fallback code from all endpoints
- `backend/routers/*.py` - Update any router endpoints with mocks
- `backend/tests/` - Update tests to use seeded data
- `docs/api-documentation.md` - Update endpoint docs
- `README.md` - Add seeding prerequisites

## Success Criteria

✅ All API endpoints query database only
✅ No hardcoded mock data in responses
✅ Clear error messages when data missing
✅ Tests pass with seeded database
✅ Frontend displays real data correctly
✅ Performance acceptable (no N+1 queries)
