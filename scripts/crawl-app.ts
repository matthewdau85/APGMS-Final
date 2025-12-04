// scripts/crawl-app.ts
//
// Crawl the APGMS admin app after login, visiting every reachable
// internal page, and save:
//  - full-page screenshots
//  - raw HTML
//  - a JSON summary per route
//
// Run with:
//   pnpm exec tsx scripts/crawl-app.ts
//
// Configure via env (optional):
//   APGMS_BASE_URL          (default: http://localhost:5173)
//   APGMS_LOGIN_PATH        (default: /)
//   APGMS_DASHBOARD_PATH    (default: /dashboard)
//   APGMS_ADMIN_EMAIL       (default: dev@example.com)
//   APGMS_ADMIN_PASSWORD    (default: admin123)
//   APGMS_MAX_PAGES         (default: 40)

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE_URL =
  process.env.APGMS_BASE_URL?.replace(/\/+$/, "") || "http://localhost:5173";

const LOGIN_PATH = process.env.APGMS_LOGIN_PATH || "/";
const DASHBOARD_PATH = process.env.APGMS_DASHBOARD_PATH || "/dashboard";

const ADMIN_EMAIL = process.env.APGMS_ADMIN_EMAIL || "dev@example.com";
const ADMIN_PASSWORD = process.env.APGMS_ADMIN_PASSWORD || "admin123";

const MAX_PAGES = Number(process.env.APGMS_MAX_PAGES || "40");

// Simple helper to make a safe filename from a route
function slugForRoute(route: string): string {
  if (!route || route === "/") return "root";
  return route
    .replace(/^\/+/, "")
    .replace(/[\/?#&]+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "") || "root";
}

async function login(page: import("@playwright/test").Page) {
  const loginUrl = `${BASE_URL}${LOGIN_PATH}`;
  console.log(`Navigating to login page: ${loginUrl}`);

  await page.goto(loginUrl, { waitUntil: "networkidle" });

  // Give SPA a moment
  await page.waitForTimeout(500);

  // Optional: wait for the heading if present
  try {
    await page
      .getByText(/APGMS Admin Login/i, { exact: false })
      .first()
      .waitFor({ timeout: 5000 });
  } catch {
    // Not fatal; continue anyway
  }

  // Prefer accessible labels (most robust)
  try {
    const emailLocator = page.getByLabel(/email/i);
    const passwordLocator = page.getByLabel(/password/i);

    await emailLocator.waitFor({ timeout: 10000 });
    await emailLocator.fill(ADMIN_EMAIL);

    await passwordLocator.waitFor({ timeout: 10000 });
    await passwordLocator.fill(ADMIN_PASSWORD);
  } catch (e) {
    console.warn("Label-based selectors failed, falling back to raw inputs...", e);

    // Fallback: generic input search
    const emailInput = page
      .locator('input[name="email"], input[type="email"], input#email')
      .first();
    const passwordInput = page
      .locator('input[name="password"], input[type="password"], input#password')
      .first();

    await emailInput.waitFor({ timeout: 10000 });
    await emailInput.fill(ADMIN_EMAIL);

    await passwordInput.waitFor({ timeout: 10000 });
    await passwordInput.fill(ADMIN_PASSWORD);
  }

  await page.click('button:has-text("Sign in"), button:has-text("Sign In")');

  // Wait for post-login navigation
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

async function crawl() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const outDir = path.join(process.cwd(), "scan-output");
  const shotsDir = path.join(outDir, "screenshots");
  const htmlDir = path.join(outDir, "html");

  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(htmlDir, { recursive: true });

  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output dir: ${outDir}`);

  console.log("Logging in...");
  await login(page);

  const startRoute = DASHBOARD_PATH;
  const queue: string[] = [startRoute];
  const visited = new Set<string>();
  const summary: any[] = [];

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const route = queue.shift()!;
    if (visited.has(route)) continue;
    visited.add(route);

    const url = `${BASE_URL}${route}`;
    console.log(`Visiting [${visited.size}/${MAX_PAGES}] ${url}`);

    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    } catch (err) {
      console.warn(`  Failed to load ${url}: ${err}`);
      continue;
    }

    const title = await page.title().catch(() => "");
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    const slug = slugForRoute(route);
    const screenshotPath = path.join(shotsDir, `${slug}.png`);
    const htmlPath = path.join(htmlDir, `${slug}.html`);

    // Save screenshot
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (err) {
      console.warn(`  Failed screenshot for ${url}: ${err}`);
    }

    // Save HTML
    try {
      const html = await page.content();
      fs.writeFileSync(htmlPath, html, "utf8");
    } catch (err) {
      console.warn(`  Failed HTML capture for ${url}: ${err}`);
    }

    summary.push({
      route,
      url,
      title,
      slug,
      screenshot: `scan-output/screenshots/${slug}.png`,
      html: `scan-output/html/${slug}.html`,
      textSnippet: (bodyText || "").slice(0, 8000),
    });

    // Discover new internal links from this page
    const hrefs = await page.$$eval('a[href^="/"]', (anchors) =>
      anchors
        .map((a) => a.getAttribute("href") || "")
        .filter((href) => !!href)
    );

    for (const href of hrefs) {
      let routePath = href.split("#")[0];
      if (!routePath.startsWith("/")) continue;
      if (routePath.toLowerCase().includes("logout")) continue;

      if (!visited.has(routePath) && !queue.includes(routePath)) {
        queue.push(routePath);
      }
    }
  }

  const summaryPath = path.join(outDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("");
  console.log(`Crawl complete.`);
  console.log(`Visited ${visited.size} page(s).`);
  console.log(`Summary: ${summaryPath}`);
  console.log(`Screenshots: ${shotsDir}`);
  console.log(`HTML: ${htmlDir}`);

  await browser.close();
}

crawl().catch((err) => {
  console.error("Crawl failed:", err);
  process.exit(1);
});
