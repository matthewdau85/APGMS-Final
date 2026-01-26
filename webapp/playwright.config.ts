// webapp/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const WEBAPP_PORT = Number(process.env.WEBAPP_PORT ?? "5173");
const API_PORT = Number(process.env.API_PORT ?? "3000");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${WEBAPP_PORT}`;
const adminToken = process.env.VITE_ADMIN_TOKEN || "demo-admin-token";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never" }]],

  webServer: [
    {
      command: `pnpm --dir ../services/api-gateway dev`,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        HOST: "127.0.0.1",
        NODE_ENV: process.env.NODE_ENV || "test",
        ENABLE_PROTOTYPE: "true",
        ENABLE_DEV_AUTH: "true",
        ADMIN_TOKEN: adminToken,
      },
    },
    {
      command: `pnpm dev -- --host 127.0.0.1 --port ${WEBAPP_PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
        VITE_ADMIN_TOKEN: adminToken,
      },
    },
  ],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "demo-video",
      testMatch: /demo-video\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        video: "on",
        trace: "on",
        screenshot: "on",
      },
    },
  ],
});
