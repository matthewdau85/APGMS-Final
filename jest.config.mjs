// Enable native ESM for Jest runtime
process.env.NODE_OPTIONS = "--experimental-vm-modules";

/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  cache: false,

  // Only TS needs special ESM treatment
  extensionsToTreatAsEsm: [".ts"],

  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json"
      }
    ]
  },

  moduleFileExtensions: ["js", "mjs", "ts"],

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },

  testMatch: ["**/tests/**/*.test.ts"],

  setupFilesAfterEnv: ["./jest.setup.cjs"],
};
