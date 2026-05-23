import { test, expect } from '@playwright/test';

test.describe('Super Admin Flow', () => {

  test('should load super admin portal', async ({ page }) => {
    await page.goto('/super-admin');

    // We expect a login form or some super admin text
    await expect(page.locator('text=Platform').first()).toBeVisible();

    // Since we don't have the platform owner password by default,
    // just assert the page loads without crashing
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.count() > 0) {
       await emailInput.first().fill('admin@example.com');
    }
  });
});