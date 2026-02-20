import { expect, test } from '@playwright/test';
import { registerApiMocks } from './utils/mockApi';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test('counties explorer renders and interactions', async ({ page }) => {
  await page.goto('/counties');

  await expect(page.getByText('Loading counties data...')).toHaveCount(0);
  await expect(page.getByText('Select a County to Explore')).toBeVisible();

  // Select a county using quick selector
  await page.getByRole('button', { name: /Nairobi/i }).click();

  // Verify details and charts using specific role-based selectors
  await expect(page.getByRole('heading', { name: 'Audit Status' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Spending by Category/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Debt Composition/i })).toBeVisible();

  // Open transparency modal
  await page.getByRole('button', { name: /Transparency Report/i }).click();
  // Modal should render some content; close via Esc (if supported) or by clicking outside
  await page.keyboard.press('Escape');
});
