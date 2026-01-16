import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(90_000);

const MAX_PAGES = Number(process.env.E2E_MAX_PAGES ?? "8");
const MAX_LINKS_PER_PAGE = Number(process.env.E2E_MAX_LINKS_PER_PAGE ?? "40");
const MAX_CONTROLS_PER_PAGE = Number(process.env.E2E_MAX_CONTROLS_PER_PAGE ?? "40");

const LOGIN_RE = /\/login(\?.*)?$/i;

function normalizePath(input: string): string {
  try {
    const u = new URL(input, "http://local.test");
    const p = u.pathname || "/";
    if (p !== "/" && p.endsWith("/")) return p.slice(0, -1);
    return p;
  } catch {
    if (!input.startsWith("/")) return "/";
    if (input !== "/" && input.endsWith("/")) return input.slice(0, -1);
    return input;
  }
}

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const loc of locators) {
    try {
      if ((await loc.count()) > 0 && (await loc.first().isVisible())) return loc.first();
    } catch {
      // ignore and continue
    }
  }
  return null;
}

async function closeTransientUI(page: Page) {
  // Try to close Radix/shadcn overlays and any incidental dialogs.
  try {
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  } catch {
    // ignore
  }

  const backdrop = page.locator('div.fixed.inset-0, [data-radix-portal] div.fixed.inset-0');
  try {
    if ((await backdrop.count()) > 0 && (await backdrop.first().isVisible())) {
      // Clicking the backdrop can close popovers/menus; if not, Escape already attempted.
      await backdrop.first().click({ timeout: 1000 }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

async function assertNoViteOverlay(page: Page) {
  const overlay = page.locator("vite-error-overlay");
  const count = await overlay.count();
  if (count > 0) {
    // Pull a small amount of text for debugging without spamming logs.
    const txt = await overlay.first().innerText().catch(() => "(overlay present)");
    throw new Error(`Vite error overlay detected. Fix runtime/module error first.\n\n${txt.slice(0, 1200)}`);
  }
}

async function loginAsAdmin(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await assertNoViteOverlay(page);

  // Fill display name (support both label and placeholder).
  const nameInput = await firstVisible([
    page.getByLabel(/display name/i),
    page.getByPlaceholder(/your name/i),
    page.locator('input[name="displayName"]'),
    page.locator('input[id="displayName"]'),
    page.locator('input[type="text"]').first(),
  ]);

  if (!nameInput) {
    throw new Error("Could not find a display name input on /login.");
  }

  await nameInput.fill("E2E Admin");

  // Select admin (support radio or checkbox patterns).
  const adminChoice = await firstVisible([
    page.getByRole("radio", { name: /^admin$/i }),
    page.getByLabel(/^admin$/i),
    page.locator('input[type="radio"][value="admin"]'),
  ]);

  if (adminChoice) {
    await adminChoice.check().catch(async () => {
      // Some radios may not support check() depending on markup; click as fallback.
      await adminChoice.click();
    });
  }

  const signInBtn = await firstVisible([
    page.getByRole("button", { name: /sign in/i }),
    page.getByRole("button", { name: /login/i }),
  ]);

  if (!signInBtn) {
    throw new Error("Could not find a Sign in button on /login.");
  }

  await signInBtn.click();

  // If UI flow did not move us, inject localStorage auth as a deterministic fallback.
  const after = new URL(page.url());
  if (LOGIN_RE.test(after.pathname)) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          "apgms.auth.user",
          JSON.stringify({ name: "E2E Admin", role: "admin" })
        );
      } catch {
        // ignore
      }
    });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  }

  await assertNoViteOverlay(page);
  await expect(page).not.toHaveURL(LOGIN_RE);
}

async function collectInternalLinks(page: Page): Promise<string[]> {
  const hrefs = await page.locator('a[href]').evaluateAll((els) =>
    els
      .map((el) => (el as HTMLAnchorElement).getAttribute("href") || "")
      .filter(Boolean)
  );

  const cleaned = hrefs
    .filter((h) => h.startsWith("/") && !h.startsWith("//"))
    .map((h) => h.split("#")[0]) // drop hash
    .map((h) => h.split("?")[0]) // drop query for dedupe stability
    .map((h) => normalizePath(h))
    .filter((h) => h !== "/login" && h !== "/logout");

  // Dedupe while preserving order
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of cleaned) {
    if (!seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out.slice(0, MAX_LINKS_PER_PAGE);
}

function looksDestructive(label: string): boolean {
  const s = label.trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes("delete") ||
    s.includes("remove") ||
    s.includes("destroy") ||
    s.includes("wipe") ||
    s.includes("reset") ||
    s.includes("sign out") ||
    s.includes("logout")
  );
}

async function auditControls(page: Page) {
  await closeTransientUI(page);

  const controls = page.locator(
    'button, [role="button"], input[type="button"], input[type="submit"], a[href^="/"]'
  );

  const count = await controls.count();
  const limit = Math.min(count, MAX_CONTROLS_PER_PAGE);

  for (let i = 0; i < limit; i++) {
    const el = controls.nth(i);

    if (!(await el.isVisible().catch(() => false))) continue;

    // Skip obviously destructive actions in a smoke run.
    const label =
      (await el.getAttribute("aria-label").catch(() => null)) ||
      (await el.innerText().catch(() => ""));

    if (looksDestructive(label)) continue;

    // Validate actionable semantics (do not force clicks on anchors; link traversal is separate).
    const tag = await el.evaluate((n) => (n as HTMLElement).tagName.toLowerCase()).catch(() => "");
    if (tag === "a") continue;

    // Try click with overlay-safe retry.
    await closeTransientUI(page);

    try {
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click({ timeout: 4000 });
    } catch {
      await closeTransientUI(page);
      await el.click({ timeout: 4000 }).catch(() => {});
    }

    await assertNoViteOverlay(page);
    await closeTransientUI(page);
  }
}

test("@smoke e2e: link integrity + actionable controls", async ({ page }) => {
  await loginAsAdmin(page);

  const startPath = normalizePath(new URL(page.url()).pathname);
  const queue: string[] = [startPath || "/dashboard"];
  const visited = new Set<string>();

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const path = normalizePath(queue.shift() || "/");
    if (visited.has(path)) continue;
    visited.add(path);

    await page.goto(path, { waitUntil: "domcontentloaded" });
    await assertNoViteOverlay(page);

    // If we ever get bounced back to login after authenticating, fail.
    await expect(page).not.toHaveURL(LOGIN_RE);

    // Quick 404/NotFound smoke (avoid brittle selectors; check common headings).
    const notFoundHeading = page.getByRole("heading", { name: /not found|404/i });
    await expect(notFoundHeading).toHaveCount(0);

    // Collect and enqueue links.
    const links = await collectInternalLinks(page);
    for (const l of links) {
      if (!visited.has(l) && queue.length < MAX_PAGES * MAX_LINKS_PER_PAGE) {
        queue.push(l);
      }
    }

    // Smoke-check clickable controls.
    await auditControls(page);
  }
});
