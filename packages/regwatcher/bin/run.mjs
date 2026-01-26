#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();

    // strip optional quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }

    // only set if not already set
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from repo root (cwd when you run pnpm scripts)
loadEnvFile(path.join(process.cwd(), ".env.local"));

// Then run the actual regwatcher "once" script (tsx)
import("../dist/run-once.js").catch(async () => {
  // Fallback if you haven't built dist: run TS entry via tsx
  const { execa } = await import("execa");
  const entry = path.join(process.cwd(), "packages", "regwatcher", "src", "run-once.ts");
  await execa("pnpm", ["--filter", "@apgms/regwatcher", "run", "once"], { stdio: "inherit" });
});
