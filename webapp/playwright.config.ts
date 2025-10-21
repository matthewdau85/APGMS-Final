import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.WEBAPP_PORT || 5173);
const BASE_URL = process.env.WEBAPP_BASE_URL || (`http://localhost:${PORT}`);

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: process.env.CI ? `pnpm preview --port ${PORT}` : `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});