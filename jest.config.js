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

  testMatch: ["**/?(*.)+(test).[tj]s?(x)"],

  // Resolve monorepo imports like @apgms/shared
  moduleNameMapper: {
    "^@apgms/(.*)$": "<rootDir>/packages/$1/src",
  },

  collectCoverageFrom: [
    "packages/**/src/**/*.ts",
    "services/api-gateway/src/**/*.ts",
  ],
};
