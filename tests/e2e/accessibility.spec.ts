import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const seriousOrCritical = (violations: Array<{ impact?: string | null }>) =>
  violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');

test.describe('Accessibility gates', () => {
  test('login and register pages have no serious axe violations', async ({ page }) => {
    for (const path of ['/login', '/register']) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(
        seriousOrCritical(results.violations),
        `${path} should not have serious or critical accessibility violations`,
      ).toEqual([]);
    }
  });
});
