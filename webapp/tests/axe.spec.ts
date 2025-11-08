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
      test('workflow alerts expose deadlines and statuses', async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const cards = page.locator('.activity__card');
        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThan(0);

        for (let index = 0; index < cardCount; index += 1) {
          const card = cards.nth(index);
          await expect(card).toHaveAttribute('aria-labelledby', /activity-name-/);
          await expect(card).toHaveAttribute('aria-describedby', /activity-detail-\d+ activity-status-\d+/);

          const deadline = card.locator('time.activity__deadline');
          await expect(deadline).toHaveCount(1);
          await expect(deadline).toHaveAttribute('aria-label', /.+/);
          await expect(deadline).toHaveAttribute('datetime', /.+/i);

          const status = card.locator('.activity__status .visually-hidden');
          await expect(status).toHaveCount(1);
        }
      });
    }
  });
}
