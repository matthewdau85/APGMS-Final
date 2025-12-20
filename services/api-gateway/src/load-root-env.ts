import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function stripQuotes(v: string): string {
  const s = v.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    const val = stripQuotes(trimmed.slice(eq + 1));

    if (!key) continue;
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// From services/api-gateway/src -> repo root is ../../../
const rootEnv = path.resolve(__dirname, "../../../.env");
loadEnvFile(rootEnv);

// Optional: allow per-service overrides if you ever add services/api-gateway/.env
const serviceEnv = path.resolve(__dirname, "../.env");
loadEnvFile(serviceEnv);
