/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.jest.json"
      }
    ]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  testMatch: ["**/tests/**/*.test.ts"],
  coverageDirectory: "../../coverage/ledger",
  clearMocks: true
};
