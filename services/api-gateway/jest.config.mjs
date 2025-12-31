export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "mjs", "cjs", "json", "node"],

  // env + jest.mocks live here (NOT in this config)
  setupFiles: ["<rootDir>/test/jest.setup.ts"],

  // Rewrite in-repo "*.js" specifiers to "*.ts" (repo code only)
  resolver: "<rootDir>/test/jest-resolver.cjs",

  moduleNameMapper: {
    // ---- shared-au lives under repoRoot/shared/au ----
    "^@apgms/shared-au/(.*)\\.js$": "<rootDir>/../../shared/au/$1.ts",
    "^@apgms/shared-au/(.*)$": "<rootDir>/../../shared/au/$1.ts",

    // ---- shared (repoRoot/shared/src) ----
    "^@apgms/shared/(.*)\\.js$": "<rootDir>/../../shared/src/$1.ts",
    "^@apgms/shared/(.*)$": "<rootDir>/../../shared/src/$1",
    "^@apgms/shared$": "<rootDir>/../../shared/src/index.ts",

    // ---- workspace packages (repoRoot/packages/*/src) ----
    "^@apgms/([^/]+)/(.+)\\.js$": "<rootDir>/../../packages/$1/src/$2.ts",
    "^@apgms/([^/]+)/(.+)$": "<rootDir>/../../packages/$1/src/$2",
    "^@apgms/([^/]+)$": "<rootDir>/../../packages/$1/src/index.ts",
  },

  transformIgnorePatterns: ["/node_modules/"],

  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "commonjs" },
      },
    ],
    "^.+\\.(mjs|cjs|js)$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "ecmascript" }, target: "es2022" },
        module: { type: "commonjs" },
      },
    ],
  },
};
