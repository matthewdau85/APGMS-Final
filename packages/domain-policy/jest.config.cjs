/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,

  /**
   * ts-jest is used ONLY for transpilation.
   * Coverage is handled by Node V8.
   */
  preset: "ts-jest",
  testEnvironment: "node",

  /**
   * 🔑 Enforce Node-native V8 coverage
   * (no babel-plugin-istanbul, no test-exclude)
   */
  coverageProvider: "v8",

  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.jest.json"
      },
    ],
  },

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",

    "^@apgms/shared-au/(.*)$":
      "<rootDir>/test/__mocks__/shared-au-$1.ts",

    "^@apgms/shared/security-log\\.js$":
      "<rootDir>/../../shared/src/security-log.ts",

    "^@apgms/domain-policy/(.*)$":
      "<rootDir>/src/$1",

    "^@apgms/shared/db$":
      "<rootDir>/../../shared/src/db.ts",
    "^@apgms/shared/db\\.js$":
      "<rootDir>/../../shared/src/db.ts",

    "^@apgms/shared/(.*)$":
      "<rootDir>/../../shared/src/$1",
  },

  testMatch: [
    "<rootDir>/test/**/*.test.[tj]s?(x)",
    "<rootDir>/tests/**/*.test.[tj]s?(x)",
    "<rootDir>/src/**/__tests__/**/*.test.[tj]s?(x)",
  ],

  testPathIgnorePatterns: [
    "/node_modules/",
    "\\.node\\.ts$"
  ],

  collectCoverageFrom: [
    "<rootDir>/src/**/*.[tj]s",
    "!<rootDir>/src/**/*.d.ts"
  ],

  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov"],

  clearMocks: true,
  restoreMocks: true,
};
