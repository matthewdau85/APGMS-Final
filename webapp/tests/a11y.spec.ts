import { test, expect } from "@playwright/test";

test("a11y smoke: app loads and has a title", async ({ page }) => {
  await page.goto("/");

  // Basic sanity checks (replace/extend with axe rules if you add @axe-core/playwright)
  await expect(page).toHaveTitle(/APGMS/i);

  // Example strict-safe iteration (prevents implicit any)
  const expectedHeadings: string[] = ["APGMS"];
  expectedHeadings.forEach((v: string) => {
    expect(v.length).toBeGreaterThan(0);
  });
});
