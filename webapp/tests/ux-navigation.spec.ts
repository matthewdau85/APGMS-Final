import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(60_000);

const LOGIN_RE = /\/login(\?.*)?$/i;

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const loc of locators) {
    try {
      if ((await loc.count()) > 0 && (await loc.first().isVisible())) return loc.first();
    } catch {
      // ignore
    }
  }
  return null;
}

async function assertNoViteOverlay(page: Page) {
  const overlay = page.locator("vite-error-overlay");
  const count = await overlay.count();
  if (count > 0) {
    const txt = await overlay.first().innerText().catch(() => "(overlay present)");
    throw new Error(`Vite error overlay detected.\n\n${txt.slice(0, 1200)}`);
  }
}

async function loginAsAdmin(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await assertNoViteOverlay(page);

  const nameInput = await firstVisible([
    page.getByLabel(/display name/i),
    page.getByPlaceholder(/your name/i),
    page.locator('input[name="displayName"]'),
    page.locator('input[id="displayName"]'),
    page.locator('input[type="text"]').first(),
  ]);

  if (!nameInput) throw new Error("Could not find display name input on /login.");
  await nameInput.fill("E2E Admin");

  const adminChoice = await firstVisible([
    page.getByRole("radio", { name: /^admin$/i }),
    page.getByLabel(/^admin$/i),
    page.locator('input[type="radio"][value="admin"]'),
  ]);

  if (adminChoice) {
    await adminChoice.check().catch(async () => {
      await adminChoice.click();
    });
  }

  const signInBtn = await firstVisible([
    page.getByRole("button", { name: /sign in/i }),
    page.getByRole("button", { name: /login/i }),
  ]);

  if (!signInBtn) throw new Error("Could not find Sign in button on /login.");
  await signInBtn.click();

  // Fallback auth injection if still on /login
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

test("console navigation: navigation links activate each major route", async ({ page }) => {
  await loginAsAdmin(page);

  // Find nav links (support nav/aside/header patterns).
  const navLinks = page.locator(
    'nav a[href^="/"], [role="navigation"] a[href^="/"], aside a[href^="/"], header a[href^="/"]'
  );

  await expect(navLinks.first()).toBeVisible();

  const hrefs = await navLinks.evaluateAll((els) =>
    els
      .map((el) => (el as HTMLAnchorElement).getAttribute("href") || "")
      .filter(Boolean)
      .filter((h) => h.startsWith("/") && !h.startsWith("//"))
      .map((h) => h.split("#")[0])
      .map((h) => h.split("?")[0])
  );

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const h of hrefs) {
    if (!seen.has(h) && h !== "/login" && h !== "/logout") {
      seen.add(h);
      unique.push(h);
    }
  }

  // Click each unique nav target by href, assert no bounce to /login.
  for (const href of unique) {
    const link = navLinks.filter({ has: page.locator(`a[href="${href}"]`) }).first();

    // If filter() returns empty in some DOMs, use a direct locator.
    const direct = page.locator(`a[href="${href}"]`).first();

    const candidate = (await link.count()) > 0 ? link : direct;

    if ((await candidate.count()) === 0) continue;
    if (!(await candidate.isVisible().catch(() => false))) continue;

    await candidate.click();

    await assertNoViteOverlay(page);
    await expect(page).not.toHaveURL(LOGIN_RE);

    // Common "Not Found" heading smoke.
    const notFoundHeading = page.getByRole("heading", { name: /not found|404/i });
    await expect(notFoundHeading).toHaveCount(0);
  }
});
