import { Page } from '@playwright/test';

export async function registerAndLogin(page: Page) {
  const email = `e2e+${Date.now()}@example.com`;
  const password = 'Password123!';

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
  const response = await page.request.post(`${apiUrl}/auth/register`, {
    data: {
      email,
      password,
      name: 'E2E Tester',
      businessName: 'E2E Business'
    }
  });

  if (!response.ok()) {
    throw new Error('Failed to register test user via API');
  }

  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL('/dashboard', { timeout: 15000 });
}