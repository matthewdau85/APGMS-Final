import { expect, test } from "@playwright/test";

test("a11y smoke: app loads and has a title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/APGMS/i);
});
