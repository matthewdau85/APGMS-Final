/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js"],
  roots: ["<rootDir>/packages", "<rootDir>/services", "<rootDir>/providers", "<rootDir>/shared"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
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
  collectCoverageFrom: [
    "packages/**/src/**/*.ts",
    "services/**/src/**/*.ts",
    "providers/**/src/**/*.ts",
    "shared/src/**/*.ts",
  ],
};
