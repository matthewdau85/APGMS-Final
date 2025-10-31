import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../src/config";

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "SHADOW_DATABASE_URL",
  "AUTH_AUDIENCE",
  "AUTH_ISSUER",
  "AUTH_JWKS",
  "AUTH_DEV_SECRET",
  "PII_KEYS",
  "PII_ACTIVE_KEY",
  "PII_SALTS",
  "PII_ACTIVE_SALT",
  "API_RATE_LIMIT_MAX",
  "API_RATE_LIMIT_WINDOW",
  "AUTH_FAILURE_THRESHOLD",
  "TAX_ENGINE_URL",
  "CORS_ALLOWED_ORIGINS",
  "ENCRYPTION_MASTER_KEY",
  "REGULATOR_ACCESS_CODE",
  "REGULATOR_JWT_AUDIENCE",
  "REGULATOR_SESSION_TTL_MINUTES",
  "REQUIRE_TLS",
  "WEBAUTHN_RP_ID",
  "WEBAUTHN_RP_NAME",
  "WEBAUTHN_ORIGIN",
] as const;

const envBackup = new Map<string, string | undefined>();

const sampleKeyMaterial = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const sampleSaltMaterial = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";
const sampleJwks = JSON.stringify({ keys: [{ kid: "local", alg: "RS256" }] });

function stashEnv() {
  envBackup.clear();
  for (const key of REQUIRED_KEYS) {
    envBackup.set(key, process.env[key]);
  }
}

function restoreEnv() {
  for (const [key, value] of envBackup.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  restoreEnv();
});

test("loadConfig parses typed values and defaults", () => {
  stashEnv();
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/apgms?schema=public";
  process.env.SHADOW_DATABASE_URL =
    "postgresql://user:pass@localhost:5432/apgms_shadow?schema=public";
  process.env.AUTH_AUDIENCE = "urn:test:aud";
  process.env.AUTH_ISSUER = "urn:test:issuer";
  process.env.AUTH_JWKS = sampleJwks;
  process.env.AUTH_DEV_SECRET = "local-dev-secret";
  process.env.PII_KEYS = JSON.stringify([{ kid: "local", material: sampleKeyMaterial }]);
  process.env.PII_ACTIVE_KEY = "local";
  process.env.PII_SALTS = JSON.stringify([{ sid: "local", secret: sampleSaltMaterial }]);
  process.env.PII_ACTIVE_SALT = "local";
  process.env.API_RATE_LIMIT_MAX = "42";
  process.env.API_RATE_LIMIT_WINDOW = "2 minutes";
  process.env.AUTH_FAILURE_THRESHOLD = "7";
  process.env.TAX_ENGINE_URL = "http://tax-engine.internal:8080";
  process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com, https://admin.example.com";
  process.env.ENCRYPTION_MASTER_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  process.env.REGULATOR_ACCESS_CODE = "code-123";
  process.env.REGULATOR_JWT_AUDIENCE = "urn:test:reg";
  process.env.REGULATOR_SESSION_TTL_MINUTES = "90";
  process.env.REQUIRE_TLS = "true";
  process.env.WEBAUTHN_RP_ID = "localhost";
  process.env.WEBAUTHN_RP_NAME = "APGMS Admin";
  process.env.WEBAUTHN_ORIGIN = "http://localhost:5173";

  const config = loadConfig();

  assert.equal(config.databaseUrl, process.env.DATABASE_URL);
  assert.equal(config.shadowDatabaseUrl, process.env.SHADOW_DATABASE_URL);
  assert.equal(config.rateLimit.max, 42);
  assert.equal(config.rateLimit.window, "2 minutes");
  assert.equal(config.security.authFailureThreshold, 7);
  assert.equal(config.security.requireHttps, true);
  assert.equal(config.taxEngineUrl, "http://tax-engine.internal:8080");
  assert.deepEqual(config.cors.allowedOrigins, [
    "https://app.example.com",
    "https://admin.example.com",
  ]);
  assert.equal(config.encryption.masterKey.length, 32);
  assert.equal(config.auth.devSecret, "local-dev-secret");
  assert.equal(config.regulator.accessCode, "code-123");
  assert.equal(config.regulator.jwtAudience, "urn:test:reg");
  assert.equal(config.regulator.sessionTtlMinutes, 90);
  assert.equal(config.webauthn.rpId, "localhost");
  assert.equal(config.webauthn.origin, "http://localhost:5173");
});

test("loadConfig fails closed when secrets missing", () => {
  stashEnv();
  delete process.env.DATABASE_URL;
  process.env.AUTH_AUDIENCE = "urn:test:aud";
  process.env.AUTH_ISSUER = "urn:test:issuer";
  process.env.AUTH_JWKS = sampleJwks;
  process.env.AUTH_DEV_SECRET = "local-dev-secret";
  process.env.PII_KEYS = JSON.stringify([{ kid: "local", material: sampleKeyMaterial }]);
  process.env.PII_ACTIVE_KEY = "local";
  process.env.PII_SALTS = JSON.stringify([{ sid: "local", secret: sampleSaltMaterial }]);
  process.env.PII_ACTIVE_SALT = "local";
  process.env.ENCRYPTION_MASTER_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  process.env.REGULATOR_ACCESS_CODE = "code-123";
  process.env.REGULATOR_JWT_AUDIENCE = "urn:test:reg";
  process.env.REGULATOR_SESSION_TTL_MINUTES = "90";
  process.env.REQUIRE_TLS = "false";
  process.env.WEBAUTHN_RP_ID = "localhost";
  process.env.WEBAUTHN_RP_NAME = "APGMS Admin";
  process.env.WEBAUTHN_ORIGIN = "http://localhost:5173";

  assert.throws(() => loadConfig(), /DATABASE_URL is required/);
});
