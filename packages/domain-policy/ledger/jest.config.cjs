/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,

  testEnvironment: "node",

  /**
   * Enforce Node-native V8 coverage
   */
  coverageProvider: "v8",

  /**
   * ONLY transform TypeScript.
   * Never touch .js files.
   */
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.jest.json"
      }
    ]
  },

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",

    "^@apgms/shared/(.*)$":
      "<rootDir>/../../shared/src/$1",

    "^@apgms/ledger/(.*)$":
      "<rootDir>/src/$1"
  },

  testMatch: [
    "<rootDir>/tests/**/*.test.ts",
    "<rootDir>/src/**/__tests__/**/*.test.ts"
  ],

  /**
   * 🔑 CRITICAL:
   * Only collect coverage from TypeScript sources.
   * This prevents Jest from ever touching .js files.
   */
  collectCoverageFrom: [
    "<rootDir>/src/**/*.ts",
    "!<rootDir>/src/**/*.d.ts"
  ],

  /**
   * Explicitly ignore JS artifacts
   */
  coveragePathIgnorePatterns: [
    "\\.js$"
  ],

  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov"],

  clearMocks: true,
  restoreMocks: true
};
