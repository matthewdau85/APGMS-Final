/** @type {import("jest").Config} */
export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.ts"],

  // ESM TS via SWC
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript" },
          target: "es2022",
        },
        module: { type: "es6" },
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],

  moduleNameMapper: {
    // IMPORTANT: allow TS "NodeNext" style imports in source (./x.js) to resolve in Jest.
    "^(\\.{1,2}/.*)\\.js$": "$1",

    // If you use these path-style imports anywhere, keep them.
    "^@apgms/([^/]+)$": "<rootDir>/../../packages/$1/src/index.ts",
    "^@apgms/([^/]+)/(.+)$": "<rootDir>/../../packages/$1/src/$2",
  },
};
