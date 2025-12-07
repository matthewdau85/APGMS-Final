/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  preset: "ts-jest",
  testEnvironment: "node",

  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.jest.json",
      },
    ],
  },

  moduleNameMapper: {
    // Allow importing compiled JS without `.js` suffix in TS files
    "^(\\.{1,2}/.*)\\.js$": "$1",

    // Existing shared-au mocks (keep these)
    "^@apgms/shared-au/(.*)$":
      "<rootDir>/test/__mocks__/shared-au-$1.ts",

    // Existing mapping for security log
    "^@apgms/shared/security-log\\.js$":
      "<rootDir>/../../shared/src/security-log.ts",

    // 🔑 NEW: map domain-policy imports into the workspace source
    "^@apgms/domain-policy/(.*)$":
      "<rootDir>/../../packages/domain-policy/src/$1",

    "^jose$": "<rootDir>/test/__mocks__/jose.ts",

  },

  // Only run Jest-style tests
  testMatch: [
    "<rootDir>/test/**/*.test.[tj]s?(x)",
    "<rootDir>/src/**/__tests__/**/*.test.[tj]s?(x)",
  ],

  testPathIgnorePatterns: [
    "/node_modules/",
    // explicitly ignore any node:test files
    ".node.ts$",
  ],

  // Coverage
  collectCoverageFrom: [
    "<rootDir>/src/**/*.[tj]s?(x)",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov"],

  clearMocks: true,
};
