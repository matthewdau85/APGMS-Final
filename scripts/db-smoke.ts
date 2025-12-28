#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

function loadDotEnvIfPresent() {
  try {
    // Optional: only loads if dotenv is installed and .env exists.
    // This keeps the script CI-safe (CI passes DATABASE_URL explicitly).
    // eslint-disable-next-line import/no-extraneous-dependencies
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;

    // dynamic import so repo doesn't hard-require dotenv
    // (but most repos already include it).
    // eslint-disable-next-line no-new-func
    return import("dotenv").then((dotenv) => {
      dotenv.config({ path: envPath });
    });
  } catch {
    return;
  }
}

await loadDotEnvIfPresent();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL is required for db smoke test");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url } },
});

try {
  // connect
  await prisma.$connect();

  // query
  const one = await prisma.$queryRaw`SELECT 1 as one`;
  if (!Array.isArray(one) || one.length !== 1) {
    throw new Error("Unexpected SELECT 1 result");
  }

  // write/read/cleanup using TEMP table (no schema mutation)
  await prisma.$executeRawUnsafe(
    "CREATE TEMP TABLE apgms_smoke (id text primary key, v int not null)"
  );

  const id = `smoke-${Date.now()}`;
  await prisma.$executeRawUnsafe(
    "INSERT INTO apgms_smoke (id, v) VALUES ($1, $2)",
    id,
    42
  );

  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, v FROM apgms_smoke WHERE id = $1",
    id
  );

  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].v !== 42) {
    throw new Error("Write/read check failed");
  }

  await prisma.$executeRawUnsafe("DELETE FROM apgms_smoke WHERE id = $1", id);

  console.log("✅ DB smoke passed (connect + query + write/read + cleanup)");
} catch (err) {
  console.error("❌ DB smoke failed:", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
