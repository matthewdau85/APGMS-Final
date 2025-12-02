/** @type {import('jest').Config} */
module.exports = {
  // No preset here – we wire ts-jest manually via transform
  testEnvironment: "node",

  // Transform TS/JS with ts-jest using the Jest tsconfig
  transform: {
    "^.+\\.[tj]sx?$": [
      require.resolve("ts-jest"),
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
        useESM: false
      }
    ]
  },

  // Your test files
  testMatch: ["**/tests/**/*.test.ts"],

  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // Allow `.js` imports in TS that map back to `.ts` sources
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },

  clearMocks: true
};
