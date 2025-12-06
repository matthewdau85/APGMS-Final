/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  preset: "ts-jest",
  testEnvironment: "node",
  coverageProvider: "v8",

  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.jest.json",
      },
    ],
  },

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@apgms/shared-au/(.*)$":
      "<rootDir>/test/__mocks__/shared-au-$1.ts",
    "^@apgms/shared/security-log\\.js$":
      "<rootDir>/../../shared/src/security-log.ts",
  },

  // Only run Jest-style tests
  testMatch: [
    "<rootDir>/test/**/*.test.[tj]s?(x)",
    "<rootDir>/src/**/__tests__/**/*.test.[tj]s?(x)",
  ],

  testPathIgnorePatterns: [
    "/node_modules/",
    "\\.node\\.[tj]s$",        // ignore node:test files
    "\\.spec\\.[tj]s$",        // hard-ignore *.spec.* for now
  ],

  coverageDirectory: "./coverage",
  clearMocks: true,
};
