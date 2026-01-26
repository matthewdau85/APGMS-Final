import { test } from "@playwright/test";

test("full demo", async ({ page }) => {
  await page.goto("/");
  await page.fill("input[name=email]", "admin@test.com");
  await page.fill("input[name=password]", "admin123");
  await page.click("text=Login");

  await page.click("text=Demo Control");
  await page.click("text=Reset & Seed Demo");

  await page.click("text=Alerts");
  await page.click("text=Resolve");

  await page.click("text=BAS");
  await page.click("text=Lodge");

  await page.click("text=Evidence");
  await page.click("text=Generate Evidence");
});
