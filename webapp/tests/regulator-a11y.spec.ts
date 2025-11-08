import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = "http://localhost:5173";

const ROUTES: Array<{
  path: string;
  label: string;
  requiresSession: boolean;
}> = [
  { path: "/regulator", label: "Regulator login", requiresSession: false },
  { path: "/regulator/portal/overview", label: "Regulator overview", requiresSession: true },
  { path: "/regulator/portal/evidence", label: "Regulator evidence", requiresSession: true },
  { path: "/regulator/portal/monitoring", label: "Regulator monitoring", requiresSession: true },
];

const SESSION_STORAGE_KEY = "apgms_regulator_session";

const MOCK_SESSION = {
  token: "playwright-token",
  orgId: "reg-demo",
  session: {
    id: "session-001",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    sessionToken: "playwright-session",
  },
};

test.describe("Regulator portal accessibility smoke", () => {
  for (const route of ROUTES) {
    test(`route ${route.path} renders without serious WCAG violations`, async ({ page }, testInfo) => {
      await page.addInitScript(({ key, session, enabled }) => {
        if (!enabled) {
          window.localStorage.removeItem(key);
          return;
        }
        window.localStorage.setItem(key, JSON.stringify(session));
      }, {
        key: SESSION_STORAGE_KEY,
        session: MOCK_SESSION,
        enabled: route.requiresSession,
      });

      await page.goto(`${BASE_URL}${route.path}`);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      await testInfo.attach(`axe-regulator-${route.path.replace(/\W+/g, "-").replace(/^-/, "") || "root"}`, {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });

      const seriousOrWorse = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? "")
      );

      expect(
        seriousOrWorse,
        [
          `Expected no serious/critical WCAG violations on ${route.label}.`,
          "See axe-regulator-* attachment for the full report.",
          JSON.stringify(seriousOrWorse, null, 2),
        ].join("\n\n"),
      ).toEqual([]);
    });
  }
});
