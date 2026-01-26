import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "e2e",
  timeout: 10 * 60 * 1000,
  expect: { timeout: 30 * 1000 },

  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],

  use: {
    baseURL,
    trace: "on",
    screenshot: "only-on-failure",
    video: "on",
  },

  outputDir: "playwright-output",

  // If your webapp is started elsewhere, set PLAYWRIGHT_BASE_URL and remove webServer.
  webServer: {
    command: "pnpm -C webapp dev --host 127.0.0.1 --port 5173",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  projects: [
    {
      name: "demo-video",
      testMatch: /.*demo-video\.spec\.ts/,
    },
  ],
});
