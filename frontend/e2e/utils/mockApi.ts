import { Page, Request, Route } from '@playwright/test';
import counties from '../fixtures/counties.json';
import debtBreakdown from '../fixtures/debt_breakdown.json';
import debtOverview from '../fixtures/debt_overview.json';
import debtTimeline from '../fixtures/debt_timeline.json';
import topLoans from '../fixtures/top_loans.json';

function jsonResponse(body: any, status: number = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

export async function registerApiMocks(page: Page) {
  await page.route('**/api/**', async (route: Route, request: Request) => {
    const url = request.url();

    // Counties endpoints
    if (url.includes('/api/v1/counties/paginated')) {
      return route.fulfill(
        jsonResponse({
          data: {
            items: counties,
            pagination: { page: 1, totalPages: 1, totalItems: counties.length },
          },
        })
      );
    }
    if (url.endsWith('/api/v1/counties') || url.includes('/api/v1/counties?')) {
      return route.fulfill(jsonResponse(counties));
    }
    if (/\/api\/v1\/counties\/[\w-]+$/.test(url)) {
      const id = url.split('/').pop() as string;
      const item = counties.find((c: any) => c.id === id) || counties[0];
      return route.fulfill(jsonResponse(item));
    }

    // Debt endpoints
    if (url.endsWith('/api/v1/debt/national')) {
      return route.fulfill(jsonResponse(debtOverview));
    }
    if (
      url.endsWith('/api/v1/debt/timeline') ||
      /\/api\/v1\/counties\/.+\/debt\/timeline/.test(url)
    ) {
      return route.fulfill(jsonResponse({ data: debtTimeline }));
    }
    if (url.endsWith('/api/v1/debt/breakdown') || /\/api\/v1\/debt\/breakdown\/.+/.test(url)) {
      return route.fulfill(jsonResponse({ data: debtBreakdown }));
    }
    if (url.endsWith('/api/v1/debt/top-loans')) {
      return route.fulfill(jsonResponse({ data: topLoans }));
    }

    // Default passthrough
    return route.continue();
  });
}
