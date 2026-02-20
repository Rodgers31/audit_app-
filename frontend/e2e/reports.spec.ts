import { expect, test } from '@playwright/test';
import { registerApiMocks } from './utils/mockApi';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test('audit reports page filters and search', async ({ page }) => {
  await page.goto('/reports');

  await expect(page.getByText('Audit Reports Made Simple')).toBeVisible();

  // Toggle report type
  await page.getByRole('button', { name: /Federal Reports/i }).click();
  await expect(page.getByText(/Major National Projects/i)).toBeVisible();
  await page.getByRole('button', { name: /County Reports/i }).click();

  // Use status filter - use heading role to avoid strict mode violation
  await expect(page.getByRole('heading', { name: /Filter by Audit Status/i })).toBeVisible();

  // Search for Nairobi
  const search = page.getByPlaceholder('Search for a county...');
  await search.fill('Nairobi');

  // Expect Nairobi county card heading to appear (use role to avoid strict mode)
  await expect(
    page.getByRole('heading', { name: 'Nairobi County County', exact: true })
  ).toBeVisible();
});
