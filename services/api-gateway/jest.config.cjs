/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: __dirname,

  testMatch: ["<rootDir>/test/**/*.test.ts"],

  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },

  moduleFileExtensions: ["ts", "js", "json"],

  moduleNameMapper: {
    // Allow TS/NodeNext-style imports in source/tests (e.g. "../src/foo.js")
    "^(\\.{1,2}/.*)\\.js$": "$1",

    // Force workspace packages to src/ during tests (avoid dist/ ESM)
    "^@apgms/shared$": "<rootDir>/../../shared/src/index.ts",
    "^@apgms/shared/(.*)\\.js$": "<rootDir>/../../shared/src/$1",
    "^@apgms/shared/(.*)$": "<rootDir>/../../shared/src/$1",

    "^@apgms/domain-policy$": "<rootDir>/../../packages/domain-policy/src/index.ts",
    "^@apgms/domain-policy/(.*)\\.js$": "<rootDir>/../../packages/domain-policy/src/$1",
    "^@apgms/domain-policy/(.*)$": "<rootDir>/../../packages/domain-policy/src/$1",
  },

  clearMocks: true,
};
