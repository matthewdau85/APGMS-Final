// e2e/demo-video.spec.ts
import { test, expect } from "@playwright/test";

test("APGMS operator demo (recorded) + demo-stress", async ({ page, request }, testInfo) => {
  // Admin RegWatcher page
  await page.goto("/admin/regwatcher");
  await expect(page.getByText("RegWatcher")).toBeVisible();

  // Run RegWatcher
  await page.getByRole("button", { name: "Run RegWatcher" }).click();
  await expect(page.getByText("Most recent run output")).toBeVisible();

  // Agent page
  await page.goto("/admin/agent");
  await expect(page.getByText("Internal orchestration and automation runner for the operator.")).toBeVisible();

  // Run demo-stress (UI)
  await page.getByLabel("Type").selectOption("demo-stress");
  await page.getByRole("button", { name: "Run" }).click();

  // Wait until it appears in recent runs and completes
  await expect(page.getByText("Recent runs")).toBeVisible();

  // Grab the newest run id from the UI by reading the first "id: " occurrence
  const firstIdLine = page.locator("text=/id: [0-9a-f\\-]{36}/").first();
  await expect(firstIdLine).toBeVisible();

  const idText = (await firstIdLine.textContent()) || "";
  const runId = idText.replace("id:", "").trim();

  // Poll API until the run completes, then attach JSON summary
  const t0 = Date.now();
  let final: any = null;

  while (Date.now() - t0 < 5 * 60 * 1000) {
    const res = await request.get(`/admin/agent/runs/${encodeURIComponent(runId)}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    final = body;
    const st = body?.run?.status;
    if (st === "succeeded" || st === "failed") break;
    await page.waitForTimeout(1000);
  }

  await testInfo.attach("demo-stress-summary.json", {
    body: Buffer.from(JSON.stringify(final, null, 2), "utf-8"),
    contentType: "application/json",
  });

  // Stable end state
  await expect(page).toHaveURL(/\/admin\/agent/);
});
