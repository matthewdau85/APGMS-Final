// playwright.config.ts (root)
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig({
    testDir: path.join(__dirname, 'webapp', 'tests'),
    retries: process.env.CI ? 2 : 0,
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    use: {
        // This matches the Vite dev server port
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
        trace: 'on-first-retry',
    },
});
//# sourceMappingURL=playwright.config.js.map