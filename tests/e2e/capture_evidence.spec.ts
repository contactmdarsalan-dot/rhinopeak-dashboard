import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const email = 'srijal@example.com';
const password = 'Password123!';

test('capture all evidence screenshots', async ({ page }) => {
  test.setTimeout(120000);
  const isMobile = test.info().project.name === 'Mobile Chrome';

  const outputDirLog1 = path.join(__dirname, '../../../Evidence_Portfolio/Log_1_Evidence');
  const outputDirLog2 = path.join(__dirname, '../../../Evidence_Portfolio/Log_2_Evidence');

  fs.mkdirSync(outputDirLog1, { recursive: true });
  fs.mkdirSync(outputDirLog2, { recursive: true });

  console.log(`[INFO] Running capture on ${isMobile ? 'Mobile' : 'Desktop'} viewport...`);

  if (!isMobile) {
    // Desktop screenshots
    // 1. Login Page
    console.log("Navigating to login page...");
    await page.goto('/login');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDirLog1, 'LO8_Frontend_login_desktop.png'), fullPage: true });

    // Log in
    console.log("Logging in...");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 20000 });
    await page.waitForTimeout(1000);

    const pages = [
      { name: 'dashboard', selector: 'a[href="/dashboard"]' },
      { name: 'sales', selector: 'a[href="/sales"]' },
      { name: 'inventory', selector: 'a[href="/inventory"]' },
      { name: 'cash-bank', selector: 'a[href="/cash-bank"]' },
      { name: 'expenses', selector: 'a[href="/expenses"]' },
      { name: 'parties', selector: 'a[href="/parties"]' },
      { name: 'reports', selector: 'a[href="/reports"]' },
      { name: 'settings', selector: 'a[href="/settings"]' },
      { name: 'super-admin', selector: null }
    ];

    for (const p of pages) {
      console.log(`Capturing ${p.name} on Desktop...`);
      if (p.selector) {
        await page.locator(p.selector).first().evaluate(el => (el as HTMLElement).click());
      } else {
        await page.goto('/super-admin');
      }
      await page.waitForTimeout(3000);
      console.log(`[DESKTOP] Navigated to ${p.name}, actual URL: ${page.url()}`);
      await page.screenshot({ path: path.join(outputDirLog2, `LO8_Frontend_${p.name}_desktop.png`), fullPage: true });
    }
  } else {
    // Mobile screenshots
    console.log("Navigating to login page on Mobile...");
    await page.goto('/login');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDirLog2, 'LO13_Responsive_login_mobile.png'), fullPage: true });

    // Log in
    console.log("Logging in on Mobile...");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 20000 });
    await page.waitForTimeout(2000);

    const pages = [
      { name: 'dashboard', selector: 'a[href="/dashboard"]' },
      { name: 'sales', selector: 'a[href="/sales"]' },
      { name: 'inventory', selector: 'a[href="/inventory"]' }
    ];

    for (const p of pages) {
      console.log(`Capturing ${p.name} on Mobile...`);
      if (p.selector) {
        await page.locator(p.selector).first().evaluate(el => (el as HTMLElement).click());
      }
      await page.waitForTimeout(3000);
      console.log(`[MOBILE] Navigated to ${p.name}, actual URL: ${page.url()}`);
      await page.screenshot({ path: path.join(outputDirLog2, `LO13_Responsive_${p.name}_mobile.png`), fullPage: true });
    }
  }

  console.log(`[INFO] Completed capture for ${isMobile ? 'Mobile' : 'Desktop'}.`);
});
