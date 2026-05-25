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
      { name: 'dashboard', url: '/dashboard' },
      { name: 'sales', url: '/sales' },
      { name: 'inventory', url: '/inventory' },
      { name: 'cash-bank', url: '/cash-bank' },
      { name: 'expenses', url: '/expenses' },
      { name: 'parties', url: '/parties' },
      { name: 'reports', url: '/reports' },
      { name: 'settings', url: '/settings' },
      { name: 'super-admin', url: '/super-admin' }
    ];

    for (const p of pages) {
      console.log(`Capturing ${p.name} on Desktop...`);
      await page.goto(p.url);
      await page.waitForTimeout(2000);
      console.log(`[DESKTOP] Navigated to ${p.url}, actual URL: ${page.url()}`);
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
      { name: 'dashboard', url: '/dashboard' },
      { name: 'sales', url: '/sales' },
      { name: 'inventory', url: '/inventory' }
    ];

    for (const p of pages) {
      console.log(`Capturing ${p.name} on Mobile...`);
      await page.goto(p.url);
      await page.waitForTimeout(2000);
      console.log(`[MOBILE] Navigated to ${p.url}, actual URL: ${page.url()}`);
      await page.screenshot({ path: path.join(outputDirLog2, `LO13_Responsive_${p.name}_mobile.png`), fullPage: true });
    }
  }

  console.log(`[INFO] Completed capture for ${isMobile ? 'Mobile' : 'Desktop'}.`);
});
