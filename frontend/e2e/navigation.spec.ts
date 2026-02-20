import { expect, test } from '@playwright/test';
import { registerApiMocks } from './utils/mockApi';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test('navbar links navigate to pages', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();

  const routes = [
    { href: '/', title: /Kenya Government Transparency Dashboard|Kenya Audit/i },
    { href: '/debt', title: /National Debt/i },
    { href: '/budget', title: /Budget|Spending/i },
    { href: '/counties', title: /County Explorer/i },
    { href: '/reports', title: /Reports - Kenya Audit Transparency/i },
  ];

  for (const r of routes) {
    await page.click(`a[href="${r.href}"]`);
    await expect(page).toHaveURL(new RegExp(`${r.href === '/' ? '/$' : r.href}`));
    await expect(page).toHaveTitle(r.title);
  }
});
