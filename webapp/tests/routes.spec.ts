import { expect, test } from '@playwright/test';
import { PRIMARY_ROUTE_CONFIG } from './routes';

test.describe('Obligation routes', () => {
  for (const route of PRIMARY_ROUTE_CONFIG) {
    test(`renders expected heading for ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      const heading = page.getByRole('heading', { level: 1 });
      if (route.match === 'exact') {
        await expect(heading).toHaveText(route.heading);
      } else {
        await expect(heading).toContainText(route.heading);
      }
    });
  }
});
