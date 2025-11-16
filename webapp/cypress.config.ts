import { defineConfig } from "cypress";

export default defineConfig({
  video: false,
  e2e: {
    baseUrl: process.env.VITE_WEB_BASE_URL ?? "http://localhost:4173",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    env: {
      apiBaseUrl: process.env.VITE_API_BASE_URL ?? "http://localhost:3000",
    },
  },
});
