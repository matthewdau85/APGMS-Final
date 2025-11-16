
/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js"],
  roots: ["<rootDir>/packages"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^@apgms/shared/(.*)\\.js$": "<rootDir>/shared/src/$1.ts",
    "^@apgms/shared/(.*)$": "<rootDir>/shared/src/$1",
    "^@apgms/shared$": "<rootDir>/shared/src/index.ts",
    "^@apgms/domain-policy$": "<rootDir>/packages/domain-policy/src/index.ts",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
    "^.+\\.js$": [
      "babel-jest",
      {},
    ],
  },
  testMatch: ["**/?(*.)+(test).[tj]s?(x)"],
  collectCoverageFrom: ["packages/**/src/**/*.ts"],
};
