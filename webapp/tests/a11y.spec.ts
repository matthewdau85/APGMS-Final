import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/bank-lines'] as const;

test.describe('Accessibility regression checks', () => {
  for (const route of ROUTES) {
    test(`ensures ${route} meets WCAG 2.1 AA requirements`, async ({ page }, testInfo) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      await testInfo.attach(`axe-results-${route === '/' ? 'home' : 'bank-lines'}`, {
        body: JSON.stringify(results, null, 2),
        contentType: 'application/json',
      });

      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
});
