/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",

  // Keep scope tight while you stabilise the spine.
  // Expand later once everything is migrated to buildTestApp().
  testMatch: ["<rootDir>/test/**/?(*.)+(test).ts"],

  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: false, decorators: false },
          target: "es2022",
        },
        module: { type: "es6" },
      },
    ],
  },

  extensionsToTreatAsEsm: [".ts"],

  // Prevent Jest from trying to treat TS path aliases as CJS
  moduleNameMapper: {
    // Optional: if you use TS path aliases like @apgms/*
    // map them to workspace packages if needed. Start minimal.
  },

  // Reduce noise
  verbose: false,
};
