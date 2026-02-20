import { expect, test } from '@playwright/test';
import { registerApiMocks } from './utils/mockApi';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test('home dashboard renders and allows county selection via quick slider', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Wait for page to load
  const mainContent = page.locator('main');
  await expect(mainContent).toBeVisible({ timeout: 20000 });

  // Check for loading text
  const loadingText = page.getByText('Loading counties data...');
  if ((await loadingText.count()) > 0) {
    await expect(loadingText).toHaveCount(0, { timeout: 15000 });
  }

  // County slider should render
  const quickSelect = page.getByText('Quick Select County:');
  await expect(quickSelect).toBeVisible({ timeout: 10000 });

  // Wait for slider to stabilize
  await page.waitForTimeout(1000);

  // Click first county button with force to bypass stability checks
  const countyButton = page.getByRole('button', { name: /Select Nairobi/i });
  await countyButton.click({ force: true });
  await page.waitForTimeout(2000);

  // County details should appear
  await expect(page.getByTestId('county-details')).toBeVisible({ timeout: 10000 });

  // Verify county name appears in the details
  await expect(page.getByRole('heading', { name: /Nairobi County County/i })).toBeVisible({
    timeout: 10000,
  });
});
