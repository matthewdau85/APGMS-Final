import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ACCESSIBILITY_ROUTES } from './routes';

test.describe('Accessibility regression checks', () => {
  for (const route of ACCESSIBILITY_ROUTES) {
    test(`ensures ${route} meets WCAG 2.1 AA requirements`, async ({ page }, testInfo) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const label = route === '/' ? 'home' : route.replace('/', '') || 'home';

      await testInfo.attach(`axe-results-${label}`, {
        body: JSON.stringify(results, null, 2),
        contentType: 'application/json',
      });

      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
});
