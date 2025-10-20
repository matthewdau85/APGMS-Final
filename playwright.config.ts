import { defineConfig } from '@playwright/test';
import path from 'node:path';

const testDir = path.join(__dirname, 'webapp', 'tests');

export default defineConfig({
  testDir,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @apgms/webapp dev -- --host 127.0.0.1 --port 4173',
        port: 4173,
        reuseExistingServer: !process.env.CI
      }
});
