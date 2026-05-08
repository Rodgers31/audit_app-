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

test('"Where every KES 100" card uses BPS framing (about KES 57, ordinary revenue)', async ({
  page,
}) => {
  await page.goto('/debt');

  await expect(
    page.getByRole('heading', { name: /Where every KES 100 of revenue goes/i }),
  ).toBeVisible();

  // Headline number: BPS values 1606 / 2835 × 100 ≈ 56.7 → rounds to 57
  await expect(page.getByTestId('debt-headline-kes')).toHaveText('57');

  // Eyebrow includes the "about" honesty hedge
  await expect(page.getByText(/Debt service takes about/i)).toBeVisible();

  // Wording explicitly says "ordinary tax & non-tax revenue"
  await expect(
    page.getByText(/ordinary tax & non-tax revenue/i),
  ).toBeVisible();

  // Allocation bar uses the same framing
  await expect(
    page.getByText(/Full allocation per KES 100 of ordinary revenue/i),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Sum exceeds 100 because ordinary revenue doesn['’]t fund the whole budget/i,
    ),
  ).toBeVisible();
});

test('debt page exposes a methodology disclosure with BPS calculation', async ({
  page,
}) => {
  await page.goto('/debt');

  // The disclosure is present and clickable
  const summary = page.getByText('How this is calculated', { exact: true });
  await expect(summary).toBeVisible();
  await summary.click();

  // The BPS calculation text appears once expanded
  await expect(
    page.getByText(/Budget Policy Statement framing/i),
  ).toBeVisible();
  await expect(
    page.getByText(/excludes borrowing and Appropriations-in-Aid/i),
  ).toBeVisible();

  // The transparency caveat is present
  await expect(
    page.getByText(/Different official debt-service measures/i),
  ).toBeVisible();
});

test('debt page does not undermine the headline with discouraging copy', async ({
  page,
}) => {
  await page.goto('/debt');
  await expect(page.getByText(/actual number is higher/i)).toHaveCount(0);
  await expect(page.getByText(/real number is higher/i)).toHaveCount(0);
  await expect(page.getByText(/this number is incomplete/i)).toHaveCount(0);
});

test('debt page source line names the BPS denominator and numerator explicitly', async ({
  page,
}) => {
  await page.goto('/debt');
  await expect(
    page.getByText(/National Treasury Budget Policy Statement/i),
  ).toBeVisible();
  await expect(
    page.getByText(/ordinary revenue excluding A-i-A and borrowing/i),
  ).toBeVisible();
  await expect(
    page.getByText(
      /public debt-related costs charged on the Consolidated Fund/i,
    ),
  ).toBeVisible();
});
