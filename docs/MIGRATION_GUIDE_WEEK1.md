# Week 1 Implementation - Database Migration Guide

## Overview

This guide covers the database migration to support **Week 1 Task 2: Data Validation Integration**.

The migration adds validation-related fields to track data quality and creates a table for rejected records that need manual review.

---

## What's Changed

### Modified Tables

#### 1. `budget_lines` table

**New columns:**

- `confidence_score` (DECIMAL(3,2)) - Validation confidence from 0.00 to 1.00
- `validation_warnings` (JSONB) - Array of warning messages

**Example data:**

```json
{
  "confidence_score": 0.85,
  "validation_warnings": ["Category has unusual casing", "Allocated amount is zero"]
}
```

#### 2. `audits` table

**New columns:**

- `confidence_score` (DECIMAL(3,2)) - Validation confidence from 0.00 to 1.00
- `validation_warnings` (JSONB) - Array of warning messages

**Example data:**

```json
{
  "confidence_score": 0.92,
  "validation_warnings": ["Finding text unusually long"]
}
```

### New Tables

#### 3. `validation_failures` table

Stores all records that failed validation (confidence < 0.7) for manual review.

**Schema:**

```sql
CREATE TABLE validation_failures (
    id SERIAL PRIMARY KEY,
    document_id INTEGER,
    data_type VARCHAR(50) NOT NULL,  -- 'budget' or 'audit'
    confidence_score DECIMAL(3,2) NOT NULL,
    validation_errors JSONB NOT NULL,  -- Array of error messages
    validation_warnings JSONB,  -- Array of warning messages
    raw_data JSONB NOT NULL,  -- Original data that failed
    rejected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed BOOLEAN NOT NULL DEFAULT false,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    resolution TEXT,
    metadata JSONB
);
```

**Indexes:**

- `ix_validation_failures_document_id` - Query by source document
- `ix_validation_failures_data_type` - Query by data type
- `ix_validation_failures_reviewed` - Filter reviewed/unreviewed
- `ix_validation_failures_rejected_at` - Order by rejection time
- `ix_validation_failures_unreviewed` (partial) - Fast review queue queries

---

## Running the Migration

### Prerequisites

1. **Backup your database** (CRITICAL):

   ```bash
   pg_dump -U postgres -d audit_app > backup_before_validation_fields_$(date +%Y%m%d).sql
   ```

2. **Ensure Alembic is installed**:

   ```bash
   cd backend
   pip install alembic
   ```

3. **Check current migration status**:
   ```bash
   cd backend
   alembic current
   ```

### Step 1: Review the Migration

Check the migration file to understand what will change:

```bash
cat backend/alembic/versions/add_validation_fields.py
```

### Step 2: Run the Migration

**Development environment:**

```bash
cd backend
alembic upgrade head
```

**Production environment (with extra safety):**

```bash
cd backend

# Dry run (shows SQL without executing)
alembic upgrade head --sql > migration_preview.sql
cat migration_preview.sql  # Review carefully

# If everything looks good, run it
alembic upgrade head
```

### Step 3: Verify the Migration

**Check new columns exist:**

```sql
-- Check budget_lines table
\d budget_lines

-- Check audits table
\d audits

-- Check new validation_failures table
\d validation_failures
```

**Query the new columns:**

```sql
-- Show budget lines with validation data
SELECT
    id,
    category,
    allocated_amount,
    confidence_score,
    validation_warnings
FROM budget_lines
WHERE confidence_score IS NOT NULL
LIMIT 5;

-- Show validation failures
SELECT
    id,
    data_type,
    confidence_score,
    validation_errors,
    rejected_at,
    reviewed
FROM validation_failures
ORDER BY rejected_at DESC
LIMIT 10;
```

---

## Rollback Instructions

If you need to undo the migration:

```bash
cd backend

# Rollback one step
alembic downgrade -1

# Or rollback to specific revision
alembic downgrade add_performance_indexes
```

**What gets removed:**

- `confidence_score` column from `budget_lines`
- `validation_warnings` column from `budget_lines`
- `confidence_score` column from `audits`
- `validation_warnings` column from `audits`
- Entire `validation_failures` table

---

## Integration with ETL Pipeline

### How It Works

The ETL pipeline (`etl/kenya_pipeline.py`) now validates all data before inserting:

**For Budget Data:**

```python
validation_result = self.data_validator.validate_budget_data(item)

if validation_result.is_valid:
    item["confidence_score"] = validation_result.confidence
    item["validation_warnings"] = validation_result.warnings
    validated_data.append(item)
else:
    # Rejected - logged but not inserted
    logger.warning(f"Rejected: {validation_result.errors}")
```

**For Audit Data:**

```python
validation_result = self.data_validator.validate_audit_data(finding)

if validation_result.is_valid:
    finding["confidence_score"] = validation_result.confidence
    finding["validation_warnings"] = validation_result.warnings
    validated_findings.append(finding)
else:
    # Rejected - logged but not inserted
    logger.warning(f"Rejected: {validation_result.errors}")
```

### Validation Rules

**Budget Data** - Confidence starts at 1.0 and is reduced by:

- Missing required fields: -0.25 each
- Negative amounts: -0.30
- Zero amounts: -0.10 (warning only)
- Large amounts (>1 trillion): -0.15 (warning only)
- Large variance (>200%): -0.10 (warning only)

**Audit Data** - Confidence starts at 1.0 and is reduced by:

- Missing required fields: -0.25 each
- Finding text too short (<10 chars): -0.10 (warning only)
- Invalid severity: -0.20

**Acceptance Threshold:** `confidence >= 0.7`

---

## Monitoring Validation Quality

### Check Validation Statistics

**Overall acceptance rate:**

```sql
-- Budget lines acceptance
SELECT
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE confidence_score >= 0.7) as accepted,
    COUNT(*) FILTER (WHERE confidence_score < 0.7) as would_reject,
    AVG(confidence_score) as avg_confidence,
    MIN(confidence_score) as min_confidence,
    MAX(confidence_score) as max_confidence
FROM budget_lines
WHERE confidence_score IS NOT NULL;
```

**Records with warnings:**

```sql
-- Budget lines with warnings
SELECT
    id,
    category,
    confidence_score,
    jsonb_array_length(validation_warnings) as warning_count,
    validation_warnings
FROM budget_lines
WHERE validation_warnings IS NOT NULL
  AND jsonb_array_length(validation_warnings) > 0
ORDER BY jsonb_array_length(validation_warnings) DESC
LIMIT 10;
```

### Review Queue

**Get unreviewed failures:**

```sql
SELECT
    id,
    data_type,
    confidence_score,
    validation_errors->>0 as primary_error,
    raw_data->>'category' as category,
    raw_data->>'allocated_amount' as amount,
    rejected_at
FROM validation_failures
WHERE reviewed = false
ORDER BY rejected_at DESC
LIMIT 20;
```

**Mark failures as reviewed:**

```sql
UPDATE validation_failures
SET
    reviewed = true,
    reviewed_by = 'admin_user',
    reviewed_at = now(),
    resolution = 'Data corrected and reprocessed'
WHERE id = 123;
```

### ETL Pipeline Logs

Check pipeline logs for validation statistics:

```bash
# View recent ETL runs
tail -n 100 backend/main_backend.log | grep -i "validation"

# Expected output:
# INFO: Data validators initialized with min_confidence=0.7
# INFO: Budget validation complete: 145/152 valid, 7 rejected, 23 warnings
# INFO: Audit validation complete: 89/91 valid, 2 rejected, 12 warnings
```

---

## Troubleshooting

### Migration fails with "column already exists"

**Problem:** Migration already partially applied.

**Solution:**

```bash
# Check what's in the database
psql -U postgres -d audit_app -c "\d budget_lines"

# If columns exist, mark migration as complete
cd backend
alembic stamp add_validation_fields
```

### High rejection rate (>20%)

**Problem:** Validation rules too strict for current data.

**Solution:**

1. Review rejected records: Check `validation_failures` table
2. Adjust validation rules in `backend/validators/data_validator.py`
3. Lower confidence threshold in `etl/kenya_pipeline.py` (currently 0.7)

### Performance degradation

**Problem:** JSONB columns slowing down queries.

**Solution:**

```sql
-- Add GIN index for JSONB columns if needed
CREATE INDEX idx_budget_validation_warnings_gin
ON budget_lines USING gin (validation_warnings);

-- Analyze table statistics
ANALYZE budget_lines;
ANALYZE audits;
ANALYZE validation_failures;
```

---

## Next Steps

After running this migration, you can:

1. **Test the ETL pipeline** with validation enabled:

   ```bash
   python -m etl.kenya_pipeline
   ```

2. **Monitor validation quality**:

   - Check `validation_failures` table for rejected records
   - Review confidence scores in production tables
   - Adjust validation rules if needed

3. **Build admin UI** for reviewing failures:
   - Display unreviewed failures from `validation_failures`
   - Allow manual correction and reprocessing
   - Track resolution outcomes

---

## Related Files

- **Migration**: `backend/alembic/versions/add_validation_fields.py`
- **Validators**: `backend/validators/data_validator.py`
- **ETL Integration**: `etl/kenya_pipeline.py`
- **Models**: `backend/models.py` (will need updates for new columns)

---

## Success Criteria

✅ Migration runs without errors
✅ New columns appear in `budget_lines` and `audits` tables
✅ `validation_failures` table created with indexes
✅ ETL pipeline runs and populates validation fields
✅ Acceptance rate > 80% (rejection rate < 20%)
✅ Average confidence score > 0.85

---

**Implementation Date:** Week 1, Task 3
**Estimated Downtime:** 0 minutes (additive migration)
**Impact:** Low - only adds columns, doesn't modify existing data
