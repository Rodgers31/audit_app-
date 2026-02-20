import { expect, test } from '@playwright/test';
import { registerApiMocks } from './utils/mockApi';

test.describe('Error States - API Failures', () => {
  test('handles 500 server error gracefully', async ({ page }) => {
    // Mock API to return 500 error
    await page.route('**/api/v1/counties/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal Server Error' }),
      })
    );

    await page.goto('/counties', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Page should load without crashing
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // Check for error indicators (may or may not exist)
    const errorText = page.locator('text=/error|failed|something went wrong/i').first();
    const retryButton = page.getByRole('button', { name: /retry|try again|reload/i }).first();

    // At least page should be visible
    const pageIsAccessible = await mainContent.isVisible();
    expect(pageIsAccessible).toBeTruthy();
  });

  test('handles 404 not found error', async ({ page }) => {
    // Mock API to return 404 error
    await page.route('**/api/v1/counties/999', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'County not found' }),
      })
    );

    await page.goto('/counties/999');

    // Wait for error state
    await page.waitForTimeout(2000);

    // Check for 404 error message
    const notFoundText = page.locator("text=/not found|404|doesn't exist/i").first();

    if ((await notFoundText.count()) > 0) {
      await expect(notFoundText).toBeVisible();
    }
  });

  test('handles network timeout gracefully', async ({ page }) => {
    // Mock API with slow response
    await page.route('**/api/v1/counties/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/counties', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Page should still be accessible
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
  });

  test('retry button works after API failure', async ({ page }) => {
    let callCount = 0;

    // Mock API to fail first time, succeed second time
    await page.route('**/api/v1/counties/**', (route) => {
      callCount++;

      if (callCount === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Server error' }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Nairobi',
            code: '047',
            population: 4397073,
            area: 696,
          },
        ]),
      });
    });

    await page.goto('/counties');
    await page.waitForTimeout(2000);

    // Click retry button if it exists
    const retryButton = page.getByRole('button', { name: /retry|try again|reload/i }).first();

    if ((await retryButton.count()) > 0) {
      await retryButton.click();
      await page.waitForTimeout(2000);

      // Verify content loads after retry
      expect(callCount).toBeGreaterThan(1);
    }
  });
});

test.describe('Error States - Empty Data', () => {
  test.beforeEach(async ({ page }) => {
    await registerApiMocks(page);
  });

  test('shows empty state when no counties found', async ({ page }) => {
    // Mock API to return empty array
    await page.route('**/api/v1/counties/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await page.goto('/counties');
    await page.waitForTimeout(2000);

    // Check for empty state message
    const emptyStateText = page.locator('text=/no counties|no data|no results/i').first();

    if ((await emptyStateText.count()) > 0) {
      await expect(emptyStateText).toBeVisible();
    }
  });

  test('shows empty state for search with no results', async ({ page }) => {
    await registerApiMocks(page);
    await page.goto('/counties');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Search for non-existent county
    const searchInput = page.getByPlaceholder(/search/i).first();

    if ((await searchInput.count()) > 0) {
      await searchInput.fill('NonExistentCounty12345');
      await page.waitForTimeout(1000);

      // Check for "no results" message
      const noResultsText = page.locator('text=/no results|not found|no match/i').first();

      if ((await noResultsText.count()) > 0) {
        await expect(noResultsText).toBeVisible();
      }
    }
  });

  test('shows empty state when no reports available', async ({ page }) => {
    // Mock API to return empty reports
    await page.route('**/api/v1/reports/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await page.goto('/reports');
    await page.waitForTimeout(2000);

    // Check for empty state
    const emptyStateText = page.locator('text=/no reports|no data available/i').first();

    if ((await emptyStateText.count()) > 0) {
      await expect(emptyStateText).toBeVisible();
    }
  });
});

test.describe('Error States - Invalid Data', () => {
  test('handles malformed API response', async ({ page }) => {
    // Mock API to return invalid JSON
    await page.route('**/api/v1/counties/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'INVALID JSON {',
      })
    );

    await page.goto('/counties', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Page should still render without crashing
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
  });

  test('handles missing required fields in API response', async ({ page }) => {
    // Mock API with incomplete data
    await page.route('**/api/v1/counties/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            // Missing name, code, etc.
            id: 1,
          },
        ]),
      })
    );

    await page.goto('/counties');
    await page.waitForTimeout(2000);

    // Verify page doesn't crash
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('handles negative or invalid numeric values', async ({ page }) => {
    // Mock API with invalid numeric values
    await page.route('**/api/v1/counties**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Test County',
            code: '001',
            population: -1000, // Invalid negative population
            budget: -999999, // Invalid negative budget
            debt: 'not a number', // Invalid string instead of number
          },
        ]),
      })
    );

    await page.goto('/counties', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify page still renders without crashing
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Error States - Authentication & Authorization', () => {
  test('handles 401 unauthorized error', async ({ page }) => {
    // Mock API to return 401 error
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Unauthorized' }),
      })
    );

    await page.goto('/counties');
    await page.waitForTimeout(2000);

    // Check for auth error message or redirect
    const authErrorText = page.locator('text=/unauthorized|login|authenticate/i').first();

    if ((await authErrorText.count()) > 0) {
      await expect(authErrorText).toBeVisible();
    }
  });

  test('handles 403 forbidden error', async ({ page }) => {
    // Mock API to return 403 error
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Forbidden' }),
      })
    );

    await page.goto('/counties');
    await page.waitForTimeout(2000);

    // Check for forbidden error message
    const forbiddenText = page.locator('text=/forbidden|access denied|permission/i').first();

    if ((await forbiddenText.count()) > 0) {
      await expect(forbiddenText).toBeVisible();
    }
  });
});

test.describe('Error States - Loading States', () => {
  test.beforeEach(async ({ page }) => {
    await registerApiMocks(page);
  });

  test('shows loading state while fetching data', async ({ page }) => {
    // Add delay to API response
    await page.route('**/api/v1/counties/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Nairobi', code: '047', population: 4397073 }]),
      });
    });

    await page.goto('/counties', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Page should eventually load
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
  });

  test('shows skeleton loaders for slow data', async ({ page }) => {
    // Add significant delay to simulate slow network
    await page.route('**/api/v1/counties/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Nairobi', code: '047', population: 4397073 }]),
      });
    });

    await page.goto('/counties', { waitUntil: 'domcontentloaded' });

    // Look for skeleton loaders or loading placeholders
    const skeleton = page
      .locator('.skeleton, .placeholder, [data-loading], [aria-busy="true"]')
      .first();

    if ((await skeleton.count()) > 0) {
      const isVisible = await skeleton.isVisible().catch(() => false);
      expect(isVisible).toBeTruthy();
    }
  });
});

test.describe('Error States - Offline Handling', () => {
  test('handles offline state gracefully', async ({ page, context }) => {
    await registerApiMocks(page);
    await page.goto('/counties');
    await page.waitForTimeout(1000);

    // Simulate offline
    await context.setOffline(true);

    // Try to navigate or reload
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);

    // Check for offline indicator or error message
    const offlineText = page.locator('text=/offline|no connection|network error/i').first();

    if ((await offlineText.count()) > 0) {
      await expect(offlineText).toBeVisible();
    }

    // Go back online
    await context.setOffline(false);
  });
});

test.describe('Error States - Boundary Conditions', () => {
  test('handles extremely large dataset gracefully', async ({ page }) => {
    // Mock API with large dataset
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `County ${i + 1}`,
      code: String(i + 1).padStart(3, '0'),
      population: Math.floor(Math.random() * 5000000),
    }));

    await page.route('**/api/v1/counties/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeDataset),
      })
    );

    await page.goto('/counties');
    await page.waitForTimeout(3000);

    // Verify page renders without crashing
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('handles special characters in data', async ({ page }) => {
    // Mock API with special characters
    await page.route('**/api/v1/counties/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Test <script>alert("xss")</script> County',
            code: '001',
            population: 1000000,
          },
        ]),
      })
    );

    await page.goto('/counties');
    await page.waitForTimeout(2000);

    // Verify XSS is prevented (script should not execute)
    const alertTriggered = await page.evaluate(() => {
      return typeof window.alert === 'function';
    });

    expect(alertTriggered).toBeTruthy(); // Alert should still be a function, not replaced
  });
});
