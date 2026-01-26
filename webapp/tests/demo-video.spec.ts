// webapp/tests/demo-video.spec.ts
import { test, expect } from "@playwright/test";

test.describe("APGMS demo video", () => {
  test("operator + prototype walkthrough", async ({ page }) => {
    test.setTimeout(240_000);

    // Login (prototype UI stores a dummy token client-side)
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
    await page.getByRole("button", { name: /login/i }).click();
    await expect(page).not.toHaveURL(/\/login$/);

    // Customer-facing pages (routing + basic UX)
    await page.goto("/bas");
    await expect(page.getByRole("heading", { name: /BAS/i })).toBeVisible();

    await page.goto("/compliance");
    await expect(page.getByRole("heading", { name: /Compliance/i })).toBeVisible();

    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: /Alerts/i })).toBeVisible();

    await page.goto("/feeds");
    await expect(page.getByRole("heading", { name: /Feeds/i })).toBeVisible();

    // Operator console
    await page.goto("/admin/regwatcher");
    await expect(page.getByRole("heading", { name: /RegWatcher/i })).toBeVisible();

    await page.getByRole("button", { name: /Refresh/i }).click();
    await page.getByRole("button", { name: /Run RegWatcher/i }).click();

    // Agent console
    await page.goto("/admin/agent");
    await expect(page.getByRole("heading", { name: /Agent/i })).toBeVisible();

    // Smoke (fast path)
    await page.getByRole("button", { name: /Run Smoke/i }).click();

    // Demo stress (real runner, waits for completion in UI polling)
    await page.getByRole("button", { name: /Run Demo Stress/i }).click();

    // Keep the final frame stable for the recording.
    await page.waitForTimeout(1500);
  });
});
