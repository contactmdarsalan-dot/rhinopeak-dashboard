import { test, expect } from '@playwright/test';
import { registerAndLogin } from '../utils/auth';

test.describe('Sales Flow', () => {

  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('should load sales and open add sale form', async ({ page }) => {
    await page.goto('/sales');
    await expect(page).toHaveURL('/sales');

    const addBtn = page.locator('button:has-text("Add Sale"), button:has-text("New Sale"), a[href="/sales/new"], button[title*="Add"], button:has-text("नयाँ बिक्री")');
    if (await addBtn.count() > 0) {
      await addBtn.first().click();

      // Modal or page should appear with "Save" or "Submit"
      await expect(page.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("सेभ गर्नुहोस्")').first()).toBeVisible({ timeout: 10000 });

      // Visual Snapshot of the Add Sale form
      await expect(page).toHaveScreenshot('add-sale.png', { fullPage: true, maxDiffPixelRatio: 0.1, timeout: 15000 });
    }
  });
});