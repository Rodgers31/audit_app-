# Week 1 Testing Guide - Caching & Validation

## Overview

This guide covers testing for **Week 1 Tasks 4 & 5**: Redis Caching Performance and Data Validation in ETL.

---

## Task 4: Test Redis Caching Performance

### Prerequisites

1. **Redis must be running:**

   ```bash
   # Check if Redis is running
   redis-cli ping
   # Expected: PONG

   # If not running, start it:
   # Windows: Start Redis service or run redis-server.exe
   # Linux/Mac: sudo service redis-server start
   # Docker: docker-compose up -d redis
   ```

2. **Backend must be running:**

   ```bash
   cd backend
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Check Redis connection in backend:**
   ```bash
   # Backend logs should show:
   # INFO: Redis cache initialized successfully
   # or
   # WARNING: Redis unavailable, using in-memory fallback
   ```

---

### Test 1: Cache Miss → Cache Hit Pattern

**Goal:** Verify that first request is slow (cache MISS), second request is fast (cache HIT).

#### Test Endpoint: `/api/v1/counties`

**First Request (Cache MISS):**

```bash
# Use curl with timing
time curl -X GET "http://localhost:8000/api/v1/counties" \
  -H "accept: application/json" \
  -w "\nTime: %{time_total}s\n"
```

**Expected:**

- Response time: 500-1000ms (database query)
- Backend log: `DEBUG: Cache MISS for cache:counties:all`

**Second Request (Cache HIT):**

```bash
# Run same command immediately
time curl -X GET "http://localhost:8000/api/v1/counties" \
  -H "accept: application/json" \
  -w "\nTime: %{time_total}s\n"
```

**Expected:**

- Response time: 50-200ms (Redis retrieval)
- Backend log: `DEBUG: Cache HIT for cache:counties:all`
- **Improvement: 70-80% faster**

---

### Test 2: All 5 Cached Endpoints

Run this script to test all endpoints:

```bash
#!/bin/bash
# test_cache_performance.sh

BASE_URL="http://localhost:8000"

echo "Testing Cache Performance for Week 1 Implementation"
echo "=================================================="
echo ""

# Test 1: Get all counties (1 hour cache)
echo "Test 1: /api/v1/counties (cache TTL: 1 hour)"
echo "First request (MISS):"
time curl -s "$BASE_URL/api/v1/counties" > /dev/null
sleep 1
echo "Second request (HIT):"
time curl -s "$BASE_URL/api/v1/counties" > /dev/null
echo ""

# Test 2: Get specific county (30 min cache)
echo "Test 2: /api/v1/counties/1 (cache TTL: 30 min)"
echo "First request (MISS):"
time curl -s "$BASE_URL/api/v1/counties/1" > /dev/null
sleep 1
echo "Second request (HIT):"
time curl -s "$BASE_URL/api/v1/counties/1" > /dev/null
echo ""

# Test 3: Get county financial data (30 min cache)
echo "Test 3: /api/v1/counties/1/financial (cache TTL: 30 min)"
echo "First request (MISS):"
time curl -s "$BASE_URL/api/v1/counties/1/financial" > /dev/null
sleep 1
echo "Second request (HIT):"
time curl -s "$BASE_URL/api/v1/counties/1/financial" > /dev/null
echo ""

# Test 4: Get county audits (1 hour cache)
echo "Test 4: /api/v1/counties/1/audits (cache TTL: 1 hour)"
echo "First request (MISS):"
time curl -s "$BASE_URL/api/v1/counties/1/audits" > /dev/null
sleep 1
echo "Second request (HIT):"
time curl -s "$BASE_URL/api/v1/counties/1/audits" > /dev/null
echo ""

# Test 5: Get country summary (1 hour cache)
echo "Test 5: /api/v1/countries/1/summary (cache TTL: 1 hour)"
echo "First request (MISS):"
time curl -s "$BASE_URL/api/v1/countries/1/summary" > /dev/null
sleep 1
echo "Second request (HIT):"
time curl -s "$BASE_URL/api/v1/countries/1/summary" > /dev/null
echo ""

echo "=================================================="
echo "Testing Complete. Check logs for HIT/MISS details."
```

**Save as:** `test_cache_performance.sh`

**Run:**

```bash
chmod +x test_cache_performance.sh
./test_cache_performance.sh
```

**Expected Results:**

```
Test 1: /api/v1/counties (cache TTL: 1 hour)
First request (MISS):
real    0m0.856s  ← Slow (database query)
Second request (HIT):
real    0m0.142s  ← Fast (83% faster!)

Test 2: /api/v1/counties/1 (cache TTL: 30 min)
First request (MISS):
real    0m0.723s  ← Slow
Second request (HIT):
real    0m0.118s  ← Fast (84% faster!)

... etc for all 5 endpoints
```

---

### Test 3: Verify Cache Keys in Redis

**Check what's stored in Redis:**

```bash
# Connect to Redis CLI
redis-cli

# List all cache keys
KEYS cache:*

# Expected output:
# 1) "cache:counties:all"
# 2) "cache:county:1"
# 3) "cache:county:1:financial"
# 4) "cache:county:1:audits"
# 5) "cache:country:1:summary"

# Check TTL (time to live) for a key
TTL cache:counties:all
# Expected: 3600 (1 hour in seconds)

TTL cache:county:1
# Expected: 1800 (30 minutes in seconds)

# Inspect a cached value
GET cache:counties:all
# Shows JSON data

# Exit Redis CLI
exit
```

---

### Test 4: Cache Invalidation

**Goal:** Verify cache expires correctly.

**Test 1-hour cache expiration:**

```bash
# Make a request
curl http://localhost:8000/api/v1/counties

# Check TTL immediately
redis-cli TTL cache:counties:all
# Expected: ~3600 seconds

# Wait 5 minutes and check again
sleep 300
redis-cli TTL cache:counties:all
# Expected: ~3300 seconds (decreased by 300)

# To test faster, manually set short TTL:
redis-cli EXPIRE cache:counties:all 5
# Wait 6 seconds
sleep 6
curl http://localhost:8000/api/v1/counties
# Should be a cache MISS (regenerates cache)
```

---

### Test 5: Performance Comparison (Before/After)

**Measure average response times:**

```bash
# Benchmark without cache (after clearing)
redis-cli FLUSHDB  # Clear all cache

# Run 10 requests and average
for i in {1..10}; do
  curl -s -w "%{time_total}\n" -o /dev/null http://localhost:8000/api/v1/counties
done | awk '{sum+=$1; count++} END {print "Average:", sum/count, "seconds"}'

# Expected: ~0.7-0.9 seconds (uncached)

# Now benchmark with cache
curl http://localhost:8000/api/v1/counties > /dev/null  # Warm cache

for i in {1..10}; do
  curl -s -w "%{time_total}\n" -o /dev/null http://localhost:8000/api/v1/counties
done | awk '{sum+=$1; count++} END {print "Average:", sum/count, "seconds"}'

# Expected: ~0.1-0.2 seconds (cached)
# Improvement: 70-85% faster
```

---

### Success Criteria for Task 4

✅ Redis responds to `PING` command
✅ Backend connects to Redis successfully
✅ First request to each endpoint is slow (cache MISS)
✅ Second request to each endpoint is fast (cache HIT)
✅ Response time improvement: **70-80% or more**
✅ Cache keys visible in Redis with correct TTL
✅ Cache expires correctly after TTL
✅ Logs show HIT/MISS patterns

---

## Task 5: Test Data Validation in ETL

### Prerequisites

1. **Database migration completed:**

   ```bash
   cd backend
   alembic current
   # Should show: add_validation_fields (current)
   ```

2. **Validation fields exist:**

   ```sql
   -- Run in psql
   \d budget_lines
   -- Should show: confidence_score, validation_warnings

   \d audits
   -- Should show: confidence_score, validation_warnings

   \d validation_failures
   -- Should show full table schema
   ```

---

### Test 1: Run ETL Pipeline with Validation

**Run the pipeline:**

```bash
cd c:\Users\rodge\projects\audit_app

# Run Kenya ETL pipeline
python -m etl.kenya_pipeline
```

**Expected log output:**

```
INFO: Data validators initialized with min_confidence=0.7
INFO: Processing source: treasury
INFO: Discovered 15 documents from treasury
INFO: Downloading document: Budget Statement FY 2023/24
INFO: Budget validation complete: 145/152 valid, 7 rejected, 23 warnings
INFO: Processing source: cob
INFO: Discovered 23 documents from cob
INFO: Downloading document: County Budget Implementation Review Q2 2023
INFO: Budget validation complete: 234/241 valid, 7 rejected, 45 warnings
INFO: Processing source: oag
INFO: Discovered 47 documents from oag
INFO: Downloading document: Nairobi County Audit Report 2022/23
INFO: Audit validation complete: 89/91 valid, 2 rejected, 12 warnings
```

**Key indicators:**

- ✅ "Data validators initialized with min_confidence=0.7"
- ✅ "validation complete: X/Y valid, Z rejected, W warnings"
- ✅ No Python exceptions or errors
- ✅ Rejection rate < 20% (7/152 ≈ 4.6% is excellent)

---

### Test 2: Verify Validated Data in Database

**Check confidence scores in budget_lines:**

```sql
-- Overall validation statistics
SELECT
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE confidence_score IS NOT NULL) as validated_records,
    COUNT(*) FILTER (WHERE confidence_score >= 0.7) as high_confidence,
    COUNT(*) FILTER (WHERE confidence_score < 0.7) as low_confidence,
    AVG(confidence_score) as avg_confidence,
    MIN(confidence_score) as min_confidence,
    MAX(confidence_score) as max_confidence
FROM budget_lines;
```

**Expected results:**

```
total_records    | 1523
validated_records| 1523  ← All records have confidence_score
high_confidence  | 1456  ← 95%+ acceptance rate
low_confidence   | 67    ← <5% should be low (but they're not in DB)
avg_confidence   | 0.89  ← Average > 0.85
min_confidence   | 0.70  ← Minimum at threshold
max_confidence   | 1.00  ← Perfect records exist
```

**Check records with warnings:**

```sql
-- Budget lines with validation warnings
SELECT
    id,
    category,
    allocated_amount,
    confidence_score,
    jsonb_array_length(validation_warnings) as warning_count,
    validation_warnings
FROM budget_lines
WHERE validation_warnings IS NOT NULL
  AND jsonb_array_length(validation_warnings) > 0
ORDER BY confidence_score ASC, warning_count DESC
LIMIT 10;
```

**Expected results:**

```
id   | category              | allocated_amount | confidence_score | warning_count | validation_warnings
-----|----------------------|------------------|------------------|---------------|---------------------
342  | INFRASTRUCTURE       | 0                | 0.75             | 2             | ["Allocated amount is zero", "Category has unusual casing"]
567  | operations           | 1500000000000    | 0.80             | 2             | ["Unusually large amount: 1500000000000", "Category has unusual casing"]
```

---

### Test 3: Check Validation Failures Table

**Query rejected records:**

```sql
-- Show recent validation failures
SELECT
    id,
    data_type,
    confidence_score,
    validation_errors,
    validation_warnings,
    raw_data->>'category' as category,
    raw_data->>'allocated_amount' as amount,
    rejected_at
FROM validation_failures
ORDER BY rejected_at DESC
LIMIT 10;
```

**Expected results:**

```
id | data_type | confidence_score | validation_errors                        | category | amount    | rejected_at
---|-----------|------------------|------------------------------------------|----------|-----------|-------------
1  | budget    | 0.45             | ["Missing required field: entity_id"]    | Health   | 5000000   | 2024-01-15 10:23:45
2  | budget    | 0.30             | ["Negative allocated amount: -250000"]   | Education| -250000   | 2024-01-15 10:23:47
3  | audit     | 0.50             | ["Missing required field: severity"]     | NULL     | NULL      | 2024-01-15 10:24:12
```

**Check failure statistics:**

```sql
-- Validation failure summary
SELECT
    data_type,
    COUNT(*) as total_failures,
    AVG(confidence_score) as avg_confidence,
    COUNT(*) FILTER (WHERE reviewed = true) as reviewed_count,
    COUNT(*) FILTER (WHERE reviewed = false) as pending_review
FROM validation_failures
GROUP BY data_type;
```

**Expected results:**

```
data_type | total_failures | avg_confidence | reviewed_count | pending_review
----------|----------------|----------------|----------------|---------------
budget    | 43             | 0.48           | 0              | 43
audit     | 7              | 0.52           | 0              | 7
```

---

### Test 4: Validation Rule Testing

**Test specific validation rules:**

**Rule: Negative amounts rejected**

```sql
-- Should return 0 rows (all negatives rejected)
SELECT COUNT(*)
FROM budget_lines
WHERE allocated_amount < 0;
```

**Rule: Missing required fields rejected**

```sql
-- Should return 0 rows (all records have required fields)
SELECT COUNT(*)
FROM budget_lines
WHERE entity_id IS NULL
   OR period_id IS NULL
   OR category IS NULL
   OR allocated_amount IS NULL;
```

**Rule: Records with warnings still accepted if confidence >= 0.7**

```sql
-- Should return some rows (warnings don't reject, just lower confidence)
SELECT COUNT(*)
FROM budget_lines
WHERE validation_warnings IS NOT NULL
  AND jsonb_array_length(validation_warnings) > 0
  AND confidence_score >= 0.7;
```

---

### Test 5: End-to-End Validation Flow

**Create test data with known issues:**

```python
# test_validation_flow.py
import sys
sys.path.insert(0, 'backend')

from validators.data_validator import DataValidator

validator = DataValidator()

# Test 1: Valid budget data
valid_data = {
    "allocated_amount": 5000000,
    "category": "Health Services",
    "entity_id": 1,
    "period_id": 2023
}
result = validator.validate_budget_data(valid_data)
print(f"Valid data: is_valid={result.is_valid}, confidence={result.confidence}")
# Expected: is_valid=True, confidence=1.0

# Test 2: Invalid budget data (negative amount)
invalid_data = {
    "allocated_amount": -5000000,
    "category": "Health Services",
    "entity_id": 1,
    "period_id": 2023
}
result = validator.validate_budget_data(invalid_data)
print(f"Invalid data: is_valid={result.is_valid}, confidence={result.confidence}, errors={result.errors}")
# Expected: is_valid=False, confidence=0.70, errors=['Negative allocated amount: -5000000']

# Test 3: Data with warnings (but still valid)
warning_data = {
    "allocated_amount": 0,  # Warning: zero amount
    "category": "INFRASTRUCTURE",  # Warning: all caps
    "entity_id": 1,
    "period_id": 2023
}
result = validator.validate_budget_data(warning_data)
print(f"Warning data: is_valid={result.is_valid}, confidence={result.confidence}, warnings={result.warnings}")
# Expected: is_valid=True, confidence=0.85, warnings=['Allocated amount is zero', 'Category has unusual casing']
```

**Run:**

```bash
python test_validation_flow.py
```

---

### Success Criteria for Task 5

✅ ETL pipeline runs without errors
✅ Logs show "Data validators initialized with min_confidence=0.7"
✅ Validation statistics logged for each document
✅ All records in `budget_lines` have `confidence_score` values
✅ All records in `audits` have `confidence_score` values
✅ `validation_failures` table contains rejected records
✅ No records in production tables with `confidence_score < 0.7`
✅ Rejection rate < 20% (ideally < 10%)
✅ Average confidence score > 0.85
✅ Validation rules working correctly (negatives rejected, warnings tracked)

---

## Week 1 Overall Success Metrics

### Performance (Task 4)

- ✅ Cache hit ratio: > 80%
- ✅ Average response time: < 200ms (cached)
- ✅ Performance improvement: 70-80%+

### Data Quality (Task 5)

- ✅ Validation coverage: 100%
- ✅ Acceptance rate: > 80%
- ✅ Average confidence: > 0.85
- ✅ Rejection tracking: All failures logged

### System Health

- ✅ No errors in backend logs
- ✅ No errors in ETL pipeline logs
- ✅ Database migration successful
- ✅ Redis stable and responsive
- ✅ API endpoints functional

---

## Troubleshooting

### Redis Issues

**Problem:** `redis-cli` not found

```bash
# Windows
# Download Redis for Windows and add to PATH

# Linux
sudo apt install redis-tools

# Docker
docker exec -it <redis-container> redis-cli
```

**Problem:** Connection refused

```bash
# Check if Redis is running
sudo systemctl status redis

# Start Redis
sudo systemctl start redis

# Or use Docker
docker-compose up -d redis
```

### Validation Issues

**Problem:** High rejection rate (>20%)

```sql
-- Identify most common errors
SELECT
    jsonb_array_elements_text(validation_errors) as error,
    COUNT(*) as occurrences
FROM validation_failures
GROUP BY error
ORDER BY occurrences DESC;

-- Solution: Adjust validation rules in data_validator.py
```

**Problem:** ETL pipeline fails with import error

```bash
# Ensure backend is in Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)/backend"

# Or run with explicit path
cd c:\Users\rodge\projects\audit_app
python -m etl.kenya_pipeline
```

---

## Next Steps After Testing

Once both tests pass:

1. **Monitor production** for 24-48 hours
2. **Review validation failures** in `validation_failures` table
3. **Adjust validation rules** if rejection rate too high/low
4. **Proceed to Week 2** implementation (smart scheduling, missing data sources)

---

**Testing Date:** Week 1, Tasks 4 & 5
**Estimated Time:** 2-3 hours total
**Required Resources:** Redis, PostgreSQL, Backend API, ETL Pipeline
