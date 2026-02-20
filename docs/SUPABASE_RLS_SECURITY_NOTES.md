# Supabase RLS Security Assessment

**Date**: October 11, 2025  
**Context**: Supabase Database Linter Warnings

---

## Overview

Supabase's database linter has flagged 13 tables in the `public` schema for missing Row Level Security (RLS) policies. This document explains the context and provides recommendations.

---

## Current Architecture

### Security Model

This application uses a **3-tier architecture**:

1. **Frontend (Next.js)** - Client-facing UI
2. **Backend (FastAPI)** - API layer with authentication/authorization
3. **Database (Supabase Postgres)** - Data persistence

**Critical Point**: The application **does NOT expose PostgREST directly to end users**. All database access goes through the FastAPI backend, which implements:

- JWT authentication
- Role-based access control (RBAC)
- Input validation
- Rate limiting
- Audit logging

---

## RLS Warnings

### Affected Tables (13 total)

| Table                   | Category       | Purpose                       |
| ----------------------- | -------------- | ----------------------------- |
| `alembic_version`       | Infrastructure | Migration tracking (internal) |
| `users`                 | Core           | User accounts                 |
| `annotations`           | Features       | User annotations on reports   |
| `countries`             | Reference      | Country metadata              |
| `entities`              | Reference      | Counties/entities             |
| `fiscal_periods`        | Reference      | Financial periods             |
| `source_documents`      | Core           | Document metadata             |
| `quick_questions`       | Features       | Quick question templates      |
| `user_question_answers` | Features       | User responses                |
| `audits`                | Core           | Audit reports                 |
| `budget_lines`          | Core           | Budget data                   |
| `extractions`           | Core           | ETL extractions               |
| `loans`                 | Features       | Loan data                     |

---

## Risk Assessment

### Current Risk Level: **LOW-MEDIUM**

**Why Low Risk?**

1. ✅ **No Direct PostgREST Exposure**: End users cannot access PostgREST API directly
2. ✅ **FastAPI Security Layer**: All requests authenticated and authorized at backend
3. ✅ **Network Security**: Database only accessible via Supabase connection pooler
4. ✅ **Principle of Least Privilege**: Database credentials not exposed to frontend

**Remaining Risk:**

1. ⚠️ **Admin/Internal Tools**: If PostgREST is enabled for admin dashboards, RLS is critical
2. ⚠️ **Service Account Compromise**: If FastAPI service account is compromised, no RLS fallback
3. ⚠️ **Future Requirements**: May need RLS if architecture changes (e.g., mobile app with direct DB access)

---

## Recommendations

### Priority 1: IMMEDIATE (If PostgREST is Exposed)

If you're using Supabase PostgREST directly (e.g., for admin tools or analytics):

```sql
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (adjust based on your auth setup)

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Admins can see all data
CREATE POLICY "Admins see all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public data (countries, entities) readable by all authenticated users
CREATE POLICY "Public reference data" ON public.countries
  FOR SELECT USING (auth.role() = 'authenticated');

-- Similar policies for other tables...
```

---

### Priority 2: MEDIUM (Defense in Depth)

Even with FastAPI security, enable RLS as a **second layer of defense**:

**Benefits:**

- Protects against service account compromise
- Enables safe admin tools (Supabase Studio, SQL editor)
- Future-proofs architecture for direct DB access
- Audit trail at database level

**Implementation Plan:**

1. **Week 1**: Enable RLS on reference tables (countries, entities, fiscal_periods)
2. **Week 2**: Add RLS to core data tables (audits, budget_lines, source_documents)
3. **Week 3**: Implement user-scoped policies (annotations, user_question_answers)
4. **Week 4**: Test and validate policies

---

### Priority 3: LOW (If Never Using PostgREST)

If you **never plan to use PostgREST** and always go through FastAPI:

**Option A: Disable PostgREST in Supabase**

- Turn off PostgREST in Supabase project settings
- Eliminates RLS warnings
- Simplifies architecture

**Option B: Acknowledge Risk**

- Document decision to not implement RLS
- Ensure FastAPI security is robust
- Regular security audits of backend code
- Monitor for unusual database access patterns

---

## Current Recommendation for This Project

**Recommendation**: **Enable RLS in Week 3-4** (after current data source integrations)

**Rationale:**

1. Current focus is KNBS integration (Task 2.1) and Open Data Portal (Task 2.2)
2. FastAPI provides sufficient security for now
3. RLS implementation requires:
   - Understanding authentication flow (Supabase Auth vs. custom JWT)
   - Defining access control policies per table
   - Testing with real user scenarios
4. Best implemented after core data pipeline is stable

**Timeline:**

- **Now (Week 2)**: Document RLS requirements
- **Week 3**: Design RLS policies
- **Week 4**: Implement RLS policies
- **Week 5**: Test and validate

---

## RLS Policy Examples

### Example 1: Public Reference Data

```sql
-- Countries table - read-only for all authenticated users
CREATE POLICY "Countries readable by authenticated users"
  ON public.countries
  FOR SELECT
  USING (auth.role() = 'authenticated');
```

---

### Example 2: User-Owned Data

```sql
-- Annotations - users can CRUD their own annotations
CREATE POLICY "Users manage own annotations"
  ON public.annotations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

### Example 3: Admin-Only Access

```sql
-- Budget lines - admins can see all, users see public data only
CREATE POLICY "Budget lines admin access"
  ON public.budget_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'analyst')
    )
    OR is_public = true
  );
```

---

### Example 4: County-Based Access

```sql
-- County officials can only see their county data
CREATE POLICY "County officials see own county"
  ON public.budget_lines
  FOR SELECT
  USING (
    entity_id IN (
      SELECT entity_id FROM public.user_counties
      WHERE user_id = auth.uid()
    )
    OR is_public = true
  );
```

---

## Implementation Checklist

When ready to implement RLS:

- [ ] **Audit current authentication**: Document how FastAPI authenticates users
- [ ] **Map Supabase Auth to app users**: Ensure `auth.uid()` matches user IDs
- [ ] **Define access levels**: Admin, analyst, county official, public
- [ ] **Create policy templates**: Reference data, user-owned, admin-only, county-scoped
- [ ] **Test policies**: Use Supabase SQL editor with different user contexts
- [ ] **Monitor performance**: RLS policies can impact query performance
- [ ] **Document policies**: Maintain policy documentation for future devs
- [ ] **Update migration scripts**: Include RLS in future schema changes

---

## Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Postgres RLS Best Practices](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Linter](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)

---

## Decision Log

| Date       | Decision               | Rationale                                                           |
| ---------- | ---------------------- | ------------------------------------------------------------------- |
| 2025-10-11 | Defer RLS to Week 3-4  | Focus on data integration first, FastAPI provides adequate security |
| TBD        | Implement RLS policies | After KNBS and Open Data Portal integrations complete               |

---

**Next Review**: End of Week 2 (after Task 2.2 completion)
