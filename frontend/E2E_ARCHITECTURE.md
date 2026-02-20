# E2E Testing Architecture - No Backend Required

## How Tests Work Without Server

### Overview

Our Playwright E2E tests **do not require the backend API server to be running**. They use **network interception** to mock all API responses with static JSON fixtures.

### Architecture Components

```
┌─────────────────────────────────────────────────┐
│   Playwright Test Runner (npm run test:e2e)    │
│   - Builds Next.js frontend (npm run build)    │
│   - Starts dev server on port 3000             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│        Next.js Frontend (localhost:3000)        │
│   - React components render normally           │
│   - TanStack Query hooks fetch data            │
│   - axios client makes API requests             │
└──────────────────┬──────────────────────────────┘
                   │
                   │ API Request: GET /api/v1/counties
                   ▼
┌─────────────────────────────────────────────────┐
│      Playwright Network Interception            │
│   registerApiMocks(page)                        │
│   - Intercepts: **/api/**                       │
│   - Returns: Static JSON fixtures               │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│         Static JSON Fixtures                    │
│   e2e/fixtures/counties.json                    │
│   e2e/fixtures/debt_overview.json               │
│   e2e/fixtures/debt_timeline.json               │
│   e2e/fixtures/top_loans.json                   │
└─────────────────────────────────────────────────┘
```

### Implementation

#### 1. Mock Registration (`e2e/utils/mockApi.ts`)

```typescript
export async function registerApiMocks(page: Page) {
  await page.route('**/api/**', async (route: Route, request: Request) => {
    const url = request.url();

    // Counties endpoint
    if (url.endsWith('/api/v1/counties')) {
      return route.fulfill(jsonResponse(counties));
    }

    // Debt endpoint
    if (url.endsWith('/api/v1/debt/national')) {
      return route.fulfill(jsonResponse(debtOverview));
    }

    // Pass through if not matched
    return route.continue();
  });
}
```

#### 2. Test Setup (`e2e/home.spec.ts`)

```typescript
test.beforeEach(async ({ page }) => {
  await registerApiMocks(page); // Intercept all API calls
});

test('home dashboard renders', async ({ page }) => {
  await page.goto('/'); // Frontend makes API calls
  // All requests to /api/** are intercepted and mocked
  await expect(page.getByText('Quick Select County:')).toBeVisible();
});
```

#### 3. Fixtures (`e2e/fixtures/counties.json`)

```json
[
  {
    "id": "nairobi",
    "name": "Nairobi County",
    "budget": 300000000000,
    "population": 4500000
  }
]
```

## Benefits of This Approach

### ✅ Fast

- No network latency
- No database queries
- Tests run in ~30 seconds

### ✅ Reliable

- No flaky network timeouts
- No backend deployment required
- Deterministic results

### ✅ Isolated

- Tests don't affect production data
- Can test edge cases with mock data
- No shared state between tests

### ✅ Complete

- Frontend logic fully exercised
- React component rendering tested
- User interactions verified
- State management validated

## What Gets Tested

### Frontend Components ✓

- React component rendering
- User interactions (clicks, typing)
- Navigation and routing
- State management (useState, TanStack Query)
- CSS/Tailwind styling
- Responsive layouts

### Not Tested (Requires Integration Tests)

- Backend API implementation
- Database queries
- ETL pipeline logic
- Authentication/authorization middleware
- CORS policies
- Rate limiting

## When to Run Integration Tests

For **full system integration tests** that require the backend:

1. **CI/CD Pipeline**: Separate job after E2E tests
2. **Pre-Release**: Manual verification with real backend
3. **Staging Environment**: Full stack deployed with real database
4. **Postman Collection**: API-level integration testing

## Mock Coverage

Current mocked endpoints:

- `GET /api/v1/counties` → `counties.json`
- `GET /api/v1/counties/:id` → Single county from `counties.json`
- `GET /api/v1/debt/national` → `debt_overview.json`
- `GET /api/v1/debt/timeline` → `debt_timeline.json`
- `GET /api/v1/debt/breakdown` → `debt_breakdown.json`
- `GET /api/v1/debt/top-loans` → `top_loans.json`

## Running Tests

```bash
# Run all E2E tests (no backend needed)
cd frontend
npm run test:e2e

# Run specific test file
npm run test:e2e -- e2e/home.spec.ts

# Run with UI for debugging
npm run test:e2e:ui

# View last test report
npx playwright show-report
```

## Test Status (Current)

- ✅ Health check (`/api/health`)
- ✅ Home dashboard with county selection
- ✅ Budget page filters and charts
- ⚠️ Counties explorer (strict mode selector issue)
- ⚠️ Debt page (strict mode selector issue)
- ⚠️ Reports page (strict mode selector issue)
- ⚠️ Navigation (title mismatch)
- ⚠️ Smoke tests (missing `<main>` tags)

## Next Steps

1. Fix strict mode violations by using more specific selectors
2. Add `<main>` wrapper tags to all pages
3. Update navigation test expectations
4. Add more mock fixtures for edge cases
5. Consider adding visual regression tests (Percy/Chromatic)
