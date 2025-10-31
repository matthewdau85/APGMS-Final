import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultTestEnv: Record<string, string> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/apgms?schema=public",
  SHADOW_DATABASE_URL: "postgresql://user:pass@localhost:5432/apgms_shadow?schema=public",
  AUTH_AUDIENCE: "urn:test:aud",
  AUTH_ISSUER: "urn:test:issuer",
  AUTH_JWKS: JSON.stringify({ keys: [{ kid: "local", alg: "RS256" }] }),
  AUTH_DEV_SECRET: "local-dev-secret",
  PII_KEYS: JSON.stringify([{ kid: "local", material: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=" }]),
  PII_ACTIVE_KEY: "local",
  PII_SALTS: JSON.stringify([{ sid: "local", secret: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=" }]),
  PII_ACTIVE_SALT: "local",
  API_RATE_LIMIT_MAX: "120",
  API_RATE_LIMIT_WINDOW: "1 minute",
  AUTH_FAILURE_THRESHOLD: "5",
  TAX_ENGINE_URL: "http://tax-engine:8000",
  CORS_ALLOWED_ORIGINS: "http://localhost:5173",
  REGULATOR_ACCESS_CODE: "regulator-dev-code",
  REGULATOR_JWT_AUDIENCE: "urn:apgms:regulator",
  REGULATOR_SESSION_TTL_MINUTES: "60",
  ENCRYPTION_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  WEBAUTHN_RP_ID: "localhost",
  WEBAUTHN_RP_NAME: "APGMS Admin",
  WEBAUTHN_ORIGIN: "http://localhost:5173",
};

for (const [key, value] of Object.entries(defaultTestEnv)) {
  const current = process.env[key];
  if (!current || current.trim().length === 0) {
    process.env[key] = value;
  }
}

const rootDir = fileURLToPath(new URL(".", import.meta.url));

async function collectSpecFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      const nested = await collectSpecFiles(fullPath);
      results.push(...nested);
      continue;
    }
    if (entry.toLowerCase().endsWith(".spec.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function loadSpecs(): Promise<void> {
  const files = await collectSpecFiles(rootDir);
  for (const file of files) {
    await import(pathToFileURL(file).href);
  }
}

await loadSpecs();
