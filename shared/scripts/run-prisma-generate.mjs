// shared/scripts/run-prisma-generate.mjs
// Temporary shim: Prisma generate is handled by the root `pnpm db:gen` script.
// This exists so `pnpm run generate` / `prebuild` succeed without doing anything extra.

console.log("run-prisma-generate.mjs: skipping (handled by root db:gen).");
