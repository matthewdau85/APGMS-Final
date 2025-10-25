
/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js"],
  roots: ["<rootDir>/packages"],
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
  collectCoverageFrom: ["packages/**/src/**/*.ts"],
};
