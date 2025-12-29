// services/api-gateway/jest.config.mjs
/** @type {import("jest").Config} */
export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.ts"],

  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "es6" },
      },
    ],
    "^.+\\.js$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "ecmascript" }, target: "es2022" },
        module: { type: "es6" },
      },
    ],
  },

  extensionsToTreatAsEsm: [".ts"],
  setupFiles: ["<rootDir>/jest.setup.cjs"],

  moduleNameMapper: {
    // Let TS NodeNext-style imports (./x.js) resolve to TS sources in Jest
    "^(\\.{1,2}/.*)\\.js$": "$1",

    // shared-au is stubbed for tests (resolver must be able to locate it)
    "^@apgms/shared-au/(.*)\\.js$": "<rootDir>/test/__mocks__/shared-au/$1.ts",
    "^@apgms/shared-au/(.*)$": "<rootDir>/test/__mocks__/shared-au/$1.ts",

    // shared package (if present)
    "^@apgms/shared$": "<rootDir>/../../shared/src/index.ts",
    "^@apgms/shared/(.*)\\.js$": "<rootDir>/../../shared/src/$1.ts",
    "^@apgms/shared/(.*)$": "<rootDir>/../../shared/src/$1",

    // Workspace packages under /packages
    "^@apgms/([^/]+)$": "<rootDir>/../../packages/$1/src/index.ts",
    "^@apgms/([^/]+)/(.*)\\.js$": "<rootDir>/../../packages/$1/src/$2.ts",
    "^@apgms/([^/]+)/(.*)$": "<rootDir>/../../packages/$1/src/$2",
  },
};
