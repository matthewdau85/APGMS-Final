
/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js"],
  roots: ["<rootDir>/packages", "<rootDir>/services"],
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
  collectCoverageFrom: [
    "packages/**/src/**/*.ts",
    "services/api-gateway/src/lib/audit.ts",
    "services/api-gateway/src/lib/idempotency.ts",
    "services/api-gateway/src/lib/validation.ts",
    "services/api-gateway/src/utils/orgScope.ts",
    "services/api-gateway/src/observability/metrics.ts",
  ],
  moduleNameMapper: {
    "^@apgms/shared$": "<rootDir>/shared/src/index.ts",
    "^@apgms/shared/(.*)$": "<rootDir>/shared/src/$1",
    "^@prisma/client$": "<rootDir>/tests/mocks/prisma-client.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  globals: {
    "ts-jest": {
      diagnostics: false,
    },
  },
};
