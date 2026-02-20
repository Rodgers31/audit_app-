import { expect, test } from '@playwright/test';
import { registerApiMocks } from './utils/mockApi';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test('national debt page shows key stats and charts', async ({ page }) => {
  await page.goto('/debt');

  await expect(page.getByText("Kenya's National Debt Explained")).toBeVisible();

  // Key stats - use role-based selectors to avoid strict mode violations
  await expect(page.getByRole('heading', { name: 'Total Debt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Per Citizen/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Debt-to-GDP/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Risk Level/i })).toBeVisible();

  // Charts sections present
  await expect(page.getByRole('heading', { name: /Debt Growth Over Time/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Domestic vs External Debt/i })).toBeVisible();

  // Top loans section present
  await expect(page.getByRole('heading', { name: /Top 5 Largest Loans/i })).toBeVisible();
});
