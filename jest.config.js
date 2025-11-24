/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js"],

  // Your tests live in:
  // - packages/**/tests
  // - services/api-gateway/test
  roots: [
    "<rootDir>/packages",
    "<rootDir>/services/api-gateway/test",
  ],

  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  extensionsToTreatAsEsm: [".ts"],

  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },

  testMatch: ["**/?(*.)+(spec|test).[tj]s?(x)"],
  testPathIgnorePatterns: ["<rootDir>/services/api-gateway/test/.*\\.spec\\.[tj]sx?$"],

  // Resolve monorepo imports like @apgms/shared
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@apgms/shared$": "<rootDir>/shared/src/index.ts",
    "^@apgms/shared/(.*)$": "<rootDir>/shared/src/$1",
    "^@apgms/(.*)$": "<rootDir>/packages/$1/src",
  },

  collectCoverageFrom: [
    "packages/**/src/**/*.ts",
    "services/api-gateway/src/**/*.ts",
  ],
};
