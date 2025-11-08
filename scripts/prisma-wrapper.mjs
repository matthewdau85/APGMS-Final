#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);

const isMigrateStatus =
  args.length >= 2 && args[0] === "migrate" && args[1] === "status";

if (!process.env.DATABASE_URL && isMigrateStatus) {
  console.warn(
    "DATABASE_URL is not set; skipping Prisma migrate status check in this workspace.",
  );
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.PRISMA_FALLBACK_DATABASE_URL ??
    "postgresql://user:pass@localhost:5432/apgms?schema=public";
}

if (!process.env.SHADOW_DATABASE_URL) {
  process.env.SHADOW_DATABASE_URL =
    process.env.PRISMA_FALLBACK_SHADOW_DATABASE_URL ??
    "postgresql://user:pass@localhost:5432/apgms_shadow?schema=public";
}

const prismaBin = join(
  dirname(fileURLToPath(import.meta.url)),
  "../node_modules/prisma/build/index.js",
);

const result = spawnSync(process.execPath, [prismaBin, ...args], {
  stdio: "inherit",
});

process.exit(result.status ?? 0);
