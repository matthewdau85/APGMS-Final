import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const loginEmail = process.env.APGMS_E2E_EMAIL ?? "dev@example.com";
const loginPassword = process.env.APGMS_E2E_PASSWORD ?? "admin123";

const protectedRoutes = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/bas", name: "BAS Lodgment" },
  { path: "/compliance", name: "Compliance" },
  { path: "/security", name: "Security / Access" },
] as const;

async function login(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/");
  await page.getByLabel("Email").fill(loginEmail);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: /Compliance Control Room/i })).toBeVisible();
}

test.describe("Compliance and security a11y smoke", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of protectedRoutes) {
    test(`${route.name} page has no serious/critical axe violations`, async ({ page }, testInfo) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const slug = route.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await testInfo.attach(`axe-results-${slug}`, {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });

      const seriousOrCritical = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );

      expect(
        seriousOrCritical,
        [
          `Found axe violations with serious/critical impact on ${route.name}`,
          JSON.stringify(seriousOrCritical, null, 2),
        ].join("\n\n"),
      ).toEqual([]);
    });
  }
});
