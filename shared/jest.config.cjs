module.exports = {
  displayName: "shared",
  testEnvironment: "node",
  rootDir: __dirname,
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
