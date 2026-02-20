# Testing Gates & CI/CD Quality Requirements

## Overview

This document outlines the **mandatory test gates** that must pass before any deployment to staging or production environments. All tests are enforced in the CI/CD pipeline and will **block deployments** if they fail.

---

## 🚦 Quality Gate Requirements

### ✅ Required for ALL Deployments

| Test Suite             | Requirement               | Enforced | Blocks Deployment |
| ---------------------- | ------------------------- | -------- | ----------------- |
| Backend Unit Tests     | ≥50% coverage, 0 failures | ✅ Yes   | ✅ Yes            |
| Frontend Unit Tests    | 0 failures                | ✅ Yes   | ✅ Yes            |
| Frontend E2E Tests     | 0 critical failures       | ✅ Yes   | ✅ Yes            |
| TypeScript Compilation | 0 errors                  | ✅ Yes   | ✅ Yes            |
| Linting                | 0 errors, 0 warnings      | ✅ Yes   | ✅ Yes            |
| Production Build       | Must succeed              | ✅ Yes   | ✅ Yes            |
| ETL Tests              | 0 failures                | ✅ Yes   | ✅ Yes            |
| Security Scan          | 0 critical/high vulns     | ✅ Yes   | ✅ Yes            |

---

## 📋 Test Suites Breakdown

### 1. Backend Tests (FastAPI + Python)

**Location**: `backend/tests/`

**Runs**:

- Unit tests for all API endpoints
- Database model validation
- Authentication/authorization logic
- Data validation and sanitization

**Requirements**:

```bash
cd backend
pytest tests/ --verbose --maxfail=1 \
  --cov=. --cov-report=xml \
  --cov-fail-under=50 \
  -m "not slow"
```

**Pass Criteria**:

- ✅ All tests pass (max 1 failure allowed before stopping)
- ✅ Code coverage ≥ 50%
- ✅ No critical linting errors (flake8 E9,F63,F7,F82)
- ✅ App imports successfully (smoke test)

**Environment**:

- PostgreSQL 15 (test database)
- Redis 7
- Python 3.11

---

### 2. Frontend Tests (Next.js + React)

**Location**: `frontend/`

**Runs**:

- **Unit Tests**: Jest/Vitest tests for components, hooks, utilities
- **Type Checking**: TypeScript compilation (`tsc --noEmit`)
- **Linting**: ESLint with zero warnings
- **Build**: Production build must succeed
- **E2E Tests**: Playwright tests for critical user journeys

**Requirements**:

```bash
cd frontend

# Linting (no warnings)
npm run lint -- --max-warnings=0

# Type checking
npx tsc --noEmit

# Unit tests
npm test -- --ci --coverage

# Build
npm run build

# E2E tests (Chromium only in CI for speed)
npx playwright test --project=chromium
```

**Pass Criteria**:

- ✅ 0 linting errors or warnings
- ✅ 0 TypeScript compilation errors
- ✅ All unit tests pass
- ✅ Production build succeeds
- ✅ All E2E tests pass (243 tests currently)

**E2E Test Coverage**:

- ✅ Navigation and routing
- ✅ Home dashboard with county selection
- ✅ Interactive Kenya map
- ✅ Counties, Debt, Reports pages
- ✅ Learn page (glossary, videos, quiz)
- ✅ Error states and API failures
- ✅ Charts and data validation
- ✅ Accessibility (ARIA, keyboard navigation)

---

### 3. ETL Tests

**Location**: `etl/`

**Runs**:

- ETL pipeline validation
- Data extraction and transformation
- Document parsing accuracy

**Requirements**:

```bash
cd etl
python -m pytest --cov=. --cov-report=xml --verbose --maxfail=1
```

**Pass Criteria**:

- ✅ All tests pass
- ✅ No data corruption
- ✅ Valid output formats

---

### 4. Security Scanning

**Tool**: Trivy (Aqua Security)

**Scans**:

- Filesystem vulnerabilities
- Dependency vulnerabilities
- Configuration issues

**Requirements**:

```bash
trivy fs . --severity CRITICAL,HIGH --exit-code 1
```

**Pass Criteria**:

- ✅ 0 critical vulnerabilities
- ✅ 0 high vulnerabilities
- ⚠️ Medium/low vulnerabilities are warnings only

---

## 🔄 CI/CD Workflow

### On Pull Request to `main`:

1. ✅ Run all test suites in parallel
2. ✅ Quality gate checks results
3. ✅ PR can only merge if ALL tests pass
4. ❌ PR blocked if any test fails

### On Push to `main`:

1. ✅ Run all test suites in parallel
2. ✅ Quality gate checks results
3. ✅ Build Docker images (if tests pass)
4. ✅ Deploy to production (if tests pass)
5. ❌ Deployment blocked if any test fails

### On Push to `develop`:

1. ✅ Run all test suites
2. ✅ Quality gate checks results
3. ✅ Deploy to staging (if tests pass)
4. ❌ Deployment blocked if any test fails

---

## ⚡ Fast Feedback Loop

To ensure developers get quick feedback:

- **Parallel Execution**: All test suites run in parallel
- **Fast Fail**: Tests stop on first failure (`--maxfail=1`)
- **Selective E2E**: CI runs Chromium only (3 browsers locally)
- **Timeouts**: Jobs timeout after 15-20 minutes
- **Caching**: Dependencies cached for faster installs

**Typical CI Run Time**:

- Backend tests: ~5-8 minutes
- Frontend tests: ~10-15 minutes
- ETL tests: ~3-5 minutes
- Security scan: ~2-3 minutes
- **Total**: ~15-20 minutes (parallel execution)

---

## 🚨 Emergency Deployment Override

In rare emergency situations, you can skip tests using:

```bash
# Manual workflow dispatch
gh workflow run docker-build-deploy.yml --field skip_tests=true
```

**⚠️ WARNING**: This should ONLY be used for:

- Critical hotfixes
- Security patches
- Emergency rollbacks

**Requirements for Emergency Deployment**:

- Must be approved by lead developer
- Must create incident report
- Must run tests locally before pushing
- Must document reason in commit message

---

## 📊 Test Reports & Monitoring

### Where to View Test Results

1. **GitHub Actions**: PR checks and workflow runs
2. **Codecov**: Coverage reports for backend
3. **Playwright Report**: E2E test results (stored as artifacts)
4. **Trivy Report**: Security scan results (GitHub Security tab)

### Monitoring

- **Failed Deployments**: Slack/email notifications
- **Coverage Trends**: Codecov dashboard
- **Test Flakiness**: Playwright UI mode for debugging

---

## 🛠️ Running Tests Locally

### Quick Test (Before Commit)

```bash
# Backend
cd backend && pytest tests/ -v

# Frontend
cd frontend && npm run lint && npm test && npm run build

# E2E (all browsers)
cd frontend && npm run test:e2e
```

### Full CI Simulation

```bash
# Install act (GitHub Actions local runner)
brew install act  # or: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run full CI locally
act pull_request
```

---

## 📈 Improving Test Coverage

### Current Coverage

- Backend: ~70% (target: 80%)
- Frontend: ~40-50% E2E (target: 70%)

### Priority Areas for New Tests

**Backend**:

1. Complex business logic in services
2. Edge cases in ETL pipeline
3. Error handling and retries
4. Authentication edge cases

**Frontend**:

1. Form validation and submission
2. Modal interactions
3. Advanced filtering and search
4. Chart interactions and tooltips
5. Mobile responsiveness

**E2E**:

1. User registration flow
2. Admin dashboard operations
3. Document upload and processing
4. Multi-step workflows

---

## 🔐 Security Testing

Beyond automated scans, consider:

1. **Manual Security Review**: Before major releases
2. **Penetration Testing**: Quarterly
3. **Dependency Audits**: Monthly with `npm audit` and `safety check`
4. **OWASP Top 10**: Regular checks against common vulnerabilities

---

## 📝 Test Naming Conventions

### Backend Tests (Pytest)

```python
# test_api.py
def test_get_counties_returns_200():
    """GET /api/v1/counties should return 200 with county list"""

def test_get_county_by_id_not_found():
    """GET /api/v1/counties/999 should return 404"""
```

### Frontend Tests (Playwright)

```typescript
// counties.spec.ts
test('counties page displays list of counties', async ({ page }) => {
  // Test implementation
});

test('clicking county navigates to detail page', async ({ page }) => {
  // Test implementation
});
```

---

## 🎯 Success Metrics

### Definition of Success

- ✅ **Zero Failed Deployments** due to broken code
- ✅ **< 5% Test Flakiness** rate
- ✅ **All PRs have tests** for new features
- ✅ **Coverage never decreases** (enforced)
- ✅ **CI runs in < 20 minutes**

### Team Responsibilities

- **Developers**: Write tests for all new features
- **Code Reviewers**: Verify test coverage in PRs
- **DevOps**: Monitor CI performance and flakiness
- **QA**: Add E2E tests for user-reported bugs

---

## 🚀 Next Steps

1. ✅ Enforce quality gates in CI/CD (DONE)
2. ⏳ Add test coverage badges to README
3. ⏳ Set up Codecov integration
4. ⏳ Configure Slack notifications for failed builds
5. ⏳ Add performance benchmarks to CI
6. ⏳ Implement visual regression testing

---

## 📚 Additional Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [GitHub Actions Workflows](https://docs.github.com/en/actions)
- [Trivy Security Scanner](https://aquasecurity.github.io/trivy/)

---

**Last Updated**: October 25, 2025  
**Maintained By**: DevOps Team  
**Questions**: Create an issue or contact the tech lead
