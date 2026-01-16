import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || process.env.PORT || 5173);

// Prefer explicit env base URL; otherwise default to a stable IPv4 loopback URL.
const DEFAULT_BASE_URL = `http://127.0.0.1:${PORT}`;
const BASE_URL =
  process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE_URL;

// If the caller provides E2E_BASE_URL, assume an external server and do not auto-start.
const disableWebServerByDefault = Boolean(process.env.E2E_BASE_URL);

// Allow explicit override either way.
const PW_NO_WEBSERVER_RAW = (process.env.PW_NO_WEBSERVER || "").toLowerCase();
const PW_FORCE_WEBSERVER_RAW = (process.env.PW_FORCE_WEBSERVER || "").toLowerCase();

const PW_NO_WEBSERVER =
  PW_NO_WEBSERVER_RAW === "1" ||
  PW_NO_WEBSERVER_RAW === "true" ||
  (disableWebServerByDefault && PW_FORCE_WEBSERVER_RAW !== "1" && PW_FORCE_WEBSERVER_RAW !== "true");

const WEB_SERVER_COMMAND =
  process.env.E2E_WEB_SERVER_COMMAND ||
  // IMPORTANT: `--strictPort` prevents Vite from silently switching ports, which makes Playwright wait forever.
  `pnpm dev -- --host 127.0.0.1 --port ${PORT} --strictPort`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // webServer is enabled for local runs by default, unless E2E_BASE_URL is provided or PW_NO_WEBSERVER=1.
  webServer: PW_NO_WEBSERVER
    ? undefined
    : {
        command: WEB_SERVER_COMMAND,
        url: DEFAULT_BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
