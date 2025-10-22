import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Home page accessibility', () => {
  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toHaveLength(0);
  });
});
