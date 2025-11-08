import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const samplePrivateKey = `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDQ+eGZUwWOgVRq\n763syRKiBSAfEfLP5u/6BoagJSwWYsMerL5vEWgoR0NiuAeiTvjn6FGzApqWBGb0\ne8YKiGXe+A15zbbNACzqwB73ku5Va+rpvphPrQT1TQsMFVYjMaHM341nU9dRvmbI\n+zcZn/RMUG0O5B4yCAK+gz3PHuL1hQ9OkvcJ0xVg1kFCXNGu72imLFhLmifb1nKk\ntN+qMq4zHnZ0SvNndftow2ftNC43gIOqfmOaEyPRjbqDvF44Xy25kRM3Css37w32\nf2iho7sA/YDutEde4W/YHUIv/efMIvYSoz2xLFTgO09/7QdaApJee2IS/nrjN1D4\nePc1lyxrAgMBAAECggEAKTD4DPbWY46Oiz2PNNs1dwY3nKg3Ck/lAY2Dv9FT7V2u\nRD+ckdwGgdn6KF1J8+5JFb0vTW+39NYNTSeQk8bq/ZY7YcTwwVvFfsg70mT94YyS\nE1zkPOBH1+pFwS37ephv4ig2gSV/jbdQH1GVPNHQn7JCrOq+IPJ/R/oqlsbpyacD\nYmJp18VaAfBcOz1TeLe/2koNgyOcNlEODvnHBAoWc15XOSM2BIACwaI0bF8ExNXb\n2lXHtG7O8nq955fmbD4wgEBLj4LRJ5ykmPAP4D3VJwJTaPicpSor4hAsl06mi9at\n9dEy3v5YcFJo6Bvx1HQJyTRyHqgSUiOwMGT4D8TscQKBgQDygrzLKCQcJ/UkJEEk\nU5qQxsgqxNvD1el+aoTTzJNWDtvkGxeykNU0N0wKdvrP2pk3I9LDalEEFHPVKeoB\ny4+L6v7VNab88TdON1/wN7JwrFGJwUGjw6d7hzYZS7eXzE+yPajfGqVkWJrSAARZ\nqRFgWk7pVRVALYqhk6q/JiDBnQKBgQDcmZ+hMkbRcW4/zkryeooPrWn36q4S+MgL\n98NodLAPdmgsVtpowZTc4WKikruBj7PhEqClagLR6Q/mfl5jy1PWoZH3722K7bPS\nL1rn+rGmL+ayG7sPI7Y6Tl1+6LqQUQ1LRf4zTZ1sdDqQtk9zxvEmp/qf6yuEyFef\na1yoIemrpwKBgB9OGSjwiZjI37BGrdIOqMk/n99FgkkJeBbFkVf19J8LU/9iL/Dx\nGVSgPsSrDz19roGbsj1foA2yxjEiM/7/VAxvzW2ge2nziXwjUdMknXhGBlCODfch\n7qDXl3g0egKycSdFJmOGgQsvFO0+61DXrlKN1dnxDck3F8o70bLTLS9RAoGAB6k+\nJfb9BqEN1yFu8OTYjprTJ0z7JqWFLQU5wBLtWlweWgvaIfE3HkSljEfUQzeeY56l\n/Zik6G1TpAmXdZfGHZoW26lxAHYo3I/QdGX8bW0UcfMMmAYBehzmmlWyxPhLoeWY\nYme7o9yVfBkYwUiTb2g+B/e+1ymuAVdVLHGhD9kCgYBWkwhG/oZCa6becA8orCmh\nJpZV9qgKUm/FrrcqYkkEzhQtidbtA6CyxmR/0ovdlEXwRZ4q0aTf3gdYWGRwKaBa\nYDweUyS+G2zY8ceH6srK3EHnN9tt55U4UD+Xcf41s1Ao60pB02kj73TvJ6qYjm1W\nfXZ6JjuJy42pptN1wxi/8g==\n-----END PRIVATE KEY-----`;
const samplePublicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0PnhmVMFjoFUau+t7MkS\nogUgHxHyz+bv+gaGoCUsFmLDHqy+bxFoKEdDYrgHok745+hRswKalgRm9HvGCohl\n3vgNec22zQAs6sAe95LuVWvq6b6YT60E9U0LDBVWIzGhzN+NZ1PXUb5myPs3GZ/0\nTFBtDuQeMggCvoM9zx7i9YUPTpL3CdMVYNZBQlzRru9opixYS5on29ZypLTfqjKu\nMx52dErzZ3X7aMNn7TQuN4CDqn5jmhMj0Y26g7xeOF8tuZETNwrLN+8N9n9ooaO7\nAP2A7rRHXuFv2B1CL/3nzCL2EqM9sSxU4DtPf+0HWgKSXntiEv564zdQ+Hj3NZcs\nawIDAQAB\n-----END PUBLIC KEY-----`;

const defaultTestEnv: Record<string, string> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/apgms?schema=public",
  SHADOW_DATABASE_URL: "postgresql://user:pass@localhost:5432/apgms_shadow?schema=public",
  AUTH_AUDIENCE: "urn:test:aud",
  AUTH_ISSUER: "urn:test:issuer",
  AUTH_JWKS: JSON.stringify({ keys: [{ kid: "local", alg: "RS256" }] }),
  AUTH_PRIVATE_KEY: samplePrivateKey,
  AUTH_PUBLIC_KEY: samplePublicKey,
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
