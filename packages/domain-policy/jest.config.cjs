/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  // Transform BOTH TS and JS with ts-jest, using the Jest-specific tsconfig
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json"
      }
    ]
  },

  // Your test files
  testMatch: ["**/tests/**/*.test.ts"],

  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  clearMocks: true
};
