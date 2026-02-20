# CI/CD Test Gates - Quick Reference

## 🎯 What You Need to Know

**All tests must pass before deployment. No exceptions (except emergency override).**

---

## ✅ Pre-Commit Checklist

Before pushing code, run these locally:

```bash
# Backend
cd backend
pytest tests/ -v
flake8 . --select=E9,F63,F7,F82

# Frontend
cd frontend
npm run lint
npm test
npm run build
npm run test:e2e
```

**If any of these fail, fix them before pushing!**

---

## 🚦 What CI/CD Tests

### Every PR and Push:

| Component    | Tests                              | Pass Criteria            |
| ------------ | ---------------------------------- | ------------------------ |
| **Backend**  | Unit tests, Coverage, Linting      | 100% pass, ≥50% coverage |
| **Frontend** | Lint, TypeScript, Unit, E2E, Build | 100% pass, 0 warnings    |
| **ETL**      | Unit tests                         | 100% pass                |
| **Security** | Trivy scan                         | 0 critical/high vulns    |

---

## ❌ When Tests Fail

### In Pull Request:

- ❌ PR cannot be merged
- ✅ Fix the failing tests
- ✅ Push fixes
- ✅ CI runs again automatically

### In Main Branch:

- ❌ Deployment automatically blocked
- 🚨 Fix ASAP or revert commit
- 📣 Notify team in Slack

---

## 🐛 Common Issues & Fixes

### "Backend tests failed"

```bash
cd backend
pytest tests/ -v  # Run locally to see details
```

**Common causes:**

- Missing database migrations
- Wrong environment variables
- Redis not running

### "Frontend E2E tests failed"

```bash
cd frontend
npx playwright test --ui  # Run in UI mode to debug
```

**Common causes:**

- Timeout issues (increase wait times)
- Missing test data/mocks
- UI changes broke selectors

### "Linting errors"

```bash
# Auto-fix most issues
cd frontend && npm run lint -- --fix
cd backend && black . && isort .
```

### "TypeScript errors"

```bash
cd frontend
npx tsc --noEmit  # See all type errors
```

Fix type errors - don't use `@ts-ignore` unless absolutely necessary.

### "Build failed"

```bash
cd frontend
npm run build  # See what's breaking
```

**Common causes:**

- Environment variables missing
- Import errors
- TypeScript errors

---

## 🚨 Emergency Deployment

**Only use if production is down!**

```bash
# Requires approval from lead developer
gh workflow run docker-build-deploy.yml --field skip_tests=true
```

⚠️ **Must document reason and run tests locally first!**

---

## 📊 Viewing Test Results

- **GitHub Actions**: See workflow runs in Actions tab
- **PR Checks**: Scroll to bottom of PR to see test status
- **Coverage**: Click Codecov link in PR
- **E2E Reports**: Download artifacts from failed workflow

---

## 💡 Writing New Tests

### Backend Test Example:

```python
# backend/tests/test_api.py
def test_get_counties_success(client):
    """Test GET /api/v1/counties returns county list"""
    response = client.get("/api/v1/counties")
    assert response.status_code == 200
    assert len(response.json()) > 0
```

### Frontend E2E Test Example:

```typescript
// frontend/e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';
import { registerApiMocks } from './utils/mockApi';

test('my feature works', async ({ page }) => {
  await registerApiMocks(page);
  await page.goto('/my-feature');
  await expect(page.locator('h1')).toBeVisible();
});
```

---

## 🎯 Coverage Requirements

- **Backend**: Minimum 50% (target 80%)
- **Frontend**: No minimum yet (improving coverage)
- **New Code**: Should have tests for main functionality

---

## 📞 Need Help?

1. Check existing tests for examples
2. Ask in team chat
3. Review test documentation: `TESTING_GATES.md`
4. Create an issue if you find a bug in tests

---

## 🚀 Best Practices

✅ **DO**:

- Write tests for new features
- Run tests locally before pushing
- Fix flaky tests immediately
- Keep test data realistic

❌ **DON'T**:

- Skip tests (except emergencies)
- Ignore failing tests
- Use `continue-on-error` in workflows
- Commit without running tests

---

**Remember: Tests are there to help you, not block you. If tests fail, it's catching bugs before users see them!**
