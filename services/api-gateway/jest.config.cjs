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
    // Strip .js extension on relative imports so Jest can find the TS sources
    "^(\\.{1,2}/.*)\\.js$": "$1",

    // shared-au mocks
    "^@apgms/shared-au/(.*)$":
      "<rootDir>/test/__mocks__/shared-au-$1.ts",

    // Security log
    "^@apgms/shared/security-log\\.js$":
      "<rootDir>/../../shared/src/security-log.ts",

    // Shared Prisma client
    "^@apgms/shared/db\\.js$":
      "<rootDir>/../../shared/src/db.js",

    // domain-policy workspace
    "^@apgms/domain-policy/(.*)$":
      "<rootDir>/../../packages/domain-policy/src/$1",

    // Mock jose (ESM)
    "^jose$": "<rootDir>/test/__mocks__/jose.ts",
  },

  testMatch: [
    "<rootDir>/test/**/*.test.[tj]s?(x)",
    "<rootDir>/src/**/__tests__/**/*.test.[tj]s?(x)",
  ],

  testPathIgnorePatterns: [
    "/node_modules/",
    ".node.ts$",
  ],

  collectCoverageFrom: [
    "<rootDir>/src/**/*.[tj]s?(x)",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov"],

  clearMocks: true,
};
