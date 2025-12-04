// scripts/scan-dashboard.ts
//
// Crawl http://localhost:5173/dashboard and any /dashboard sub-pages
// it links to, then dump basic structure + screenshots for each page.
//
// Run from repo root (WSL):
//   pnpm exec tsx scripts/scan-dashboard.ts
//
// Requires: @playwright/test (provides the "playwright" runtime).

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:5173";
const START_PATH = "/dashboard";

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function slugFromPath(p: string): string {
  const cleaned = p.replace(/[\/:?&=]+/g, "_").replace(/^_+/, "");
  return cleaned.length ? cleaned : "root";
}

async function main() {
  const outDir = path.join(process.cwd(), "tmp", "dashboard-scan");
  await ensureDir(outDir);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const visited = new Set<string>();
  const queue: string[] = [START_PATH];

  while (queue.length > 0) {
    const relPath = queue.shift()!;
    if (visited.has(relPath)) continue;
    visited.add(relPath);

    const url = new URL(relPath, BASE_URL).toString();
    console.log(`Scanning ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Give SPA time to render
    await page.waitForTimeout(500);

    // Collect headings
    const headings = await page.$$eval("h1,h2,h3", (els) =>
      els
        .map((el) => ({
          level: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim(),
        }))
        .filter((h) => h.text.length > 0)
    );

    // Collect roles present on the page (landmarks, etc.)
    const roles = await page.$$eval("[role]", (els) => {
      const set = new Set<string>();
      for (const el of els) {
        const r = el.getAttribute("role");
        if (r) set.add(r);
      }
      return Array.from(set);
    });

    // Collect dashboard-internal links (/dashboard...)
    const dashboardLinks = await page.$$eval('a[href^="/dashboard"]', (els) => {
      const set = new Set<string>();
      for (const el of els) {
        const href = (el as HTMLAnchorElement).getAttribute("href");
        if (href) set.add(href);
      }
      return Array.from(set);
    });

    // Enqueue any new /dashboard links
    for (const href of dashboardLinks) {
      if (!visited.has(href) && !queue.includes(href)) {
        queue.push(href);
      }
    }

    // Screenshot
    const slug = slugFromPath(relPath);
    const screenshotPath = path.join(outDir, `${slug}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Save structured summary
    const summary = {
      url,
      path: relPath,
      headings,
      roles,
      links: dashboardLinks,
      timestamp: new Date().toISOString(),
    };

    const jsonPath = path.join(outDir, `${slug}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");

    console.log(
      `  → Saved screenshot: ${path.relative(process.cwd(), screenshotPath)}`
    );
    console.log(
      `  → Saved summary:    ${path.relative(process.cwd(), jsonPath)}`
    );
  }

  await browser.close();
  console.log(`Done. Visited ${visited.size} dashboard page(s). Output in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
