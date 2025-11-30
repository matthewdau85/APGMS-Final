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
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@apgms/shared-au/(.*)$": "<rootDir>/test/__mocks__/shared-au-$1.ts",
    "^@apgms/shared/security-log\\.js$": "<rootDir>/../../shared/src/security-log.ts"
  },
  testMatch: ["**/__never__/**"], // disable tests for now
  setupFilesAfterEnv: ["<rootDir>/jest.setup.cjs"],
  coverageDirectory: "./coverage",
  clearMocks: true,
};
