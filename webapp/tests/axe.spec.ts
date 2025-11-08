import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/', '/bank-lines'] as const;

for (const route of routes) {
  test.describe(`Accessibility for ${route}`, () => {
    test(`should have no detectable Axe violations on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    if (route === '/') {
      test('should keep metrics section free of structural violations', async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const metricsSection = page.locator('section[aria-label="Key metrics"]');
        await expect(metricsSection).toBeVisible();

        const targetedResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .include('section[aria-label="Key metrics"]')
          .analyze();

        expect(targetedResults.violations).toEqual([]);
      });
    }
  });
}
