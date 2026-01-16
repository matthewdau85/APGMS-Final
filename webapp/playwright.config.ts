import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.WEBAPP_PORT || 5173);

// Prefer E2E_BASE_URL first (explicit), then WEBAPP_BASE_URL, else stable default.
const BASE_URL =
  process.env.E2E_BASE_URL ||
  process.env.WEBAPP_BASE_URL ||
  `http://127.0.0.1:${PORT}`;

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: BASE_URL,
    // Keep traces lightweight by default; enable full trace by setting PW_TRACE=1.
    trace: process.env.PW_TRACE ? 'on' : 'on-first-retry',
  },
  webServer: {
    // CRITICAL: strictPort prevents Vite silently switching ports (which makes Playwright hang).
    command: isCI
      ? `pnpm preview -- --host 127.0.0.1 --port ${PORT} --strictPort`
      : `pnpm dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
