import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

//
// Update this if your preview server runs somewhere else in CI.
// In local dev you'd hit Vite at :5173, in CI maybe it's served differently.
// This constant is what replaces the hardcoded page.goto("http://localhost:5173/")
// from the single-page version.
//
const BASE_URL = "http://localhost:5173";

// Add every route in the web UI you consider user-facing / important.
const ROUTES = ["/", "/bank-lines"] as const;

test.describe("Accessibility regression checks (WCAG 2.1 A/AA)", () => {
  for (const route of ROUTES) {
    test(`route ${route} has no WCAG 2.1 A/AA violations of serious/critical impact`, async ({
      page,
    }, testInfo) => {
      // Navigate to full URL so we're not depending on playwright.config.ts baseURL
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState("networkidle");

      // Run axe against this page
      const results = await new AxeBuilder({ page })
        // Enforce WCAG 2.0/2.1 A + AA rulesets. This matches common compliance targets.
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      // Attach full axe JSON to the Playwright report/artifacts in CI
      await testInfo.attach(
        `axe-results-${route === "/" ? "home" : route.replace("/", "") || "root"}`,
        {
          body: JSON.stringify(results, null, 2),
          contentType: "application/json",
        }
      );

      //
      // We’ll fail the test if there are any violations that axe thinks are
      // "serious" or "critical". This preserves the intent of your original
      // single-page test.
      //
      const seriousOrWorse = results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? "")
      );

      expect(
        seriousOrWorse,
        [
          "Found accessibility violations with serious/critical impact.",
          "See attached axe-results-* artifact in CI for details.",
          JSON.stringify(seriousOrWorse, null, 2),
        ].join("\n\n")
      ).toEqual([]);

      //
      // Optional stricter mode:
      // If you want to block on ANY A/AA violation (not just serious/critical),
      // uncomment this block and remove the seriousOrWorse assertion above.
      //
      // expect(
      //   results.violations,
      //   JSON.stringify(results.violations, null, 2)
      // ).toEqual([]);
    });
  }
});
