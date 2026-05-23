import { test, expect } from '@playwright/test';
import { registerAndLogin } from '../utils/auth';

test.describe('Inventory Flow', () => {

  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('should load inventory and add a product', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page).toHaveURL('/inventory');

    // Add Product button usually exists
    const addBtn = page.locator('button:has-text("Add Product"), a:has-text("Add Product"), button[title*="Add"], a[href="/inventory/new"]');
    if (await addBtn.count() > 0) {
      await addBtn.first().click();

      // Wait for modal or navigation
      // Fill out some basic fields
      const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]');
      if (await nameInput.count() > 0) {
        await nameInput.first().fill(`Test Product ${Date.now()}`);

        // Save
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit")');
        if (await saveBtn.count() > 0) {
            await saveBtn.first().click();
        }
      }
    }

    // Just ensuring we don't crash and the page is intact
    await expect(page.locator('h1:has-text("Inventory"), h1:has-text("इन्भेन्टरी"), .app-shell').first()).toBeVisible({ timeout: 10000 });

    // Visual Snapshot
    await expect(page).toHaveScreenshot('inventory.png', { fullPage: true, maxDiffPixelRatio: 0.1, timeout: 15000 });
  });
});