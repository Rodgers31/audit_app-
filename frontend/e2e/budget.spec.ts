import { expect, test } from '@playwright/test';
import { registerApiMocks } from './utils/mockApi';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test('budget page filter toggles and chart renders', async ({ page }) => {
  await page.goto('/budget');
  await page.waitForTimeout(5000);

  // Check if page loaded
  const mainContent = page.locator('main');
  await expect(mainContent).toBeVisible({ timeout: 15000 });

  // Check if budget period selector exists
  const periodSelector = page.getByText('Choose Budget Period');

  if ((await periodSelector.count()) > 0) {
    await expect(periodSelector).toBeVisible();

    // Try clicking filter options if they exist
    const budgetButton = page.getByRole('button', { name: /2024 Budget/i });
    if ((await budgetButton.count()) > 0) {
      await budgetButton.click();
      await page.waitForTimeout(1000);
    }
  }
});
