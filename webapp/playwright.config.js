"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const PORT = Number(process.env.WEBAPP_PORT || 5173);
const BASE_URL = process.env.WEBAPP_BASE_URL || (`http://localhost:${PORT}`);
exports.default = (0, test_1.defineConfig)({
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
        { name: 'chromium', use: { ...test_1.devices['Desktop Chrome'] } },
    ],
});
//# sourceMappingURL=playwright.config.js.map