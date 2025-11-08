import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../src/config";

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "SHADOW_DATABASE_URL",
  "AUTH_AUDIENCE",
  "AUTH_ISSUER",
  "AUTH_JWKS",
  "AUTH_PRIVATE_KEY",
  "AUTH_PUBLIC_KEY",
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
const samplePrivateKey = `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDQ+eGZUwWOgVRq\n763syRKiBSAfEfLP5u/6BoagJSwWYsMerL5vEWgoR0NiuAeiTvjn6FGzApqWBGb0\ne8YKiGXe+A15zbbNACzqwB73ku5Va+rpvphPrQT1TQsMFVYjMaHM341nU9dRvmbI\n+zcZn/RMUG0O5B4yCAK+gz3PHuL1hQ9OkvcJ0xVg1kFCXNGu72imLFhLmifb1nKk\ntN+qMq4zHnZ0SvNndftow2ftNC43gIOqfmOaEyPRjbqDvF44Xy25kRM3Css37w32\nf2iho7sA/YDutEde4W/YHUIv/efMIvYSoz2xLFTgO09/7QdaApJee2IS/nrjN1D4\nePc1lyxrAgMBAAECggEAKTD4DPbWY46Oiz2PNNs1dwY3nKg3Ck/lAY2Dv9FT7V2u\nRD+ckdwGgdn6KF1J8+5JFb0vTW+39NYNTSeQk8bq/ZY7YcTwwVvFfsg70mT94YyS\nE1zkPOBH1+pFwS37ephv4ig2gSV/jbdQH1GVPNHQn7JCrOq+IPJ/R/oqlsbpyacD\nYmJp18VaAfBcOz1TeLe/2koNgyOcNlEODvnHBAoWc15XOSM2BIACwaI0bF8ExNXb\n2lXHtG7O8nq955fmbD4wgEBLj4LRJ5ykmPAP4D3VJwJTaPicpSor4hAsl06mi9at\n9dEy3v5YcFJo6Bvx1HQJyTRyHqgSUiOwMGT4D8TscQKBgQDygrzLKCQcJ/UkJEEk\nU5qQxsgqxNvD1el+aoTTzJNWDtvkGxeykNU0N0wKdvrP2pk3I9LDalEEFHPVKeoB\ny4+L6v7VNab88TdON1/wN7JwrFGJwUGjw6d7hzYZS7eXzE+yPajfGqVkWJrSAARZ\nqRFgWk7pVRVALYqhk6q/JiDBnQKBgQDcmZ+hMkbRcW4/zkryeooPrWn36q4S+MgL\n98NodLAPdmgsVtpowZTc4WKikruBj7PhEqClagLR6Q/mfl5jy1PWoZH3722K7bPS\nL1rn+rGmL+ayG7sPI7Y6Tl1+6LqQUQ1LRf4zTZ1sdDqQtk9zxvEmp/qf6yuEyFef\na1yoIemrpwKBgB9OGSjwiZjI37BGrdIOqMk/n99FgkkJeBbFkVf19J8LU/9iL/Dx\nGVSgPsSrDz19roGbsj1foA2yxjEiM/7/VAxvzW2ge2nziXwjUdMknXhGBlCODfch\n7qDXl3g0egKycSdFJmOGgQsvFO0+61DXrlKN1dnxDck3F8o70bLTLS9RAoGAB6k+\nJfb9BqEN1yFu8OTYjprTJ0z7JqWFLQU5wBLtWlweWgvaIfE3HkSljEfUQzeeY56l\n/Zik6G1TpAmXdZfGHZoW26lxAHYo3I/QdGX8bW0UcfMMmAYBehzmmlWyxPhLoeWY\nYme7o9yVfBkYwUiTb2g+B/e+1ymuAVdVLHGhD9kCgYBWkwhG/oZCa6becA8orCmh\nJpZV9qgKUm/FrrcqYkkEzhQtidbtA6CyxmR/0ovdlEXwRZ4q0aTf3gdYWGRwKaBa\nYDweUyS+G2zY8ceH6srK3EHnN9tt55U4UD+Xcf41s1Ao60pB02kj73TvJ6qYjm1W\nfXZ6JjuJy42pptN1wxi/8g==\n-----END PRIVATE KEY-----`;
const samplePublicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0PnhmVMFjoFUau+t7MkS\nogUgHxHyz+bv+gaGoCUsFmLDHqy+bxFoKEdDYrgHok745+hRswKalgRm9HvGCohl\n3vgNec22zQAs6sAe95LuVWvq6b6YT60E9U0LDBVWIzGhzN+NZ1PXUb5myPs3GZ/0\nTFBtDuQeMggCvoM9zx7i9YUPTpL3CdMVYNZBQlzRru9opixYS5on29ZypLTfqjKu\nMx52dErzZ3X7aMNn7TQuN4CDqn5jmhMj0Y26g7xeOF8tuZETNwrLN+8N9n9ooaO7\nAP2A7rRHXuFv2B1CL/3nzCL2EqM9sSxU4DtPf+0HWgKSXntiEv564zdQ+Hj3NZcs\nawIDAQAB\n-----END PUBLIC KEY-----`;

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
  process.env.AUTH_PRIVATE_KEY = samplePrivateKey;
  process.env.AUTH_PUBLIC_KEY = samplePublicKey;
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
  assert.equal(config.auth.privateKey, samplePrivateKey.replace(/\\n/g, "\n"));
  assert.equal(config.auth.publicKey, samplePublicKey.replace(/\\n/g, "\n"));
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
  process.env.AUTH_PRIVATE_KEY = samplePrivateKey;
  process.env.AUTH_PUBLIC_KEY = samplePublicKey;
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
