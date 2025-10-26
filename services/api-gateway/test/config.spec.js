import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config";
const REQUIRED_KEYS = [
    "DATABASE_URL",
    "SHADOW_DATABASE_URL",
    "AUTH_AUDIENCE",
    "AUTH_ISSUER",
    "AUTH_JWKS",
    "PII_KEYS",
    "PII_ACTIVE_KEY",
    "PII_SALTS",
    "PII_ACTIVE_SALT",
    "API_RATE_LIMIT_MAX",
    "API_RATE_LIMIT_WINDOW",
    "AUTH_FAILURE_THRESHOLD",
    "TAX_ENGINE_URL",
    "CORS_ALLOWED_ORIGINS",
];
const envBackup = new Map();
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
        }
        else {
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
    process.env.PII_KEYS = JSON.stringify([{ kid: "local", material: sampleKeyMaterial }]);
    process.env.PII_ACTIVE_KEY = "local";
    process.env.PII_SALTS = JSON.stringify([{ sid: "local", secret: sampleSaltMaterial }]);
    process.env.PII_ACTIVE_SALT = "local";
    process.env.API_RATE_LIMIT_MAX = "42";
    process.env.API_RATE_LIMIT_WINDOW = "2 minutes";
    process.env.AUTH_FAILURE_THRESHOLD = "7";
    process.env.TAX_ENGINE_URL = "http://tax-engine.internal:8080";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com, https://admin.example.com";
    const config = loadConfig();
    assert.equal(config.databaseUrl, process.env.DATABASE_URL);
    assert.equal(config.shadowDatabaseUrl, process.env.SHADOW_DATABASE_URL);
    assert.equal(config.rateLimit.max, 42);
    assert.equal(config.rateLimit.window, "2 minutes");
    assert.equal(config.security.authFailureThreshold, 7);
    assert.equal(config.taxEngineUrl, "http://tax-engine.internal:8080");
    assert.deepEqual(config.cors.allowedOrigins, [
        "https://app.example.com",
        "https://admin.example.com",
    ]);
});
test("loadConfig fails closed when secrets missing", () => {
    stashEnv();
    delete process.env.DATABASE_URL;
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";
    process.env.AUTH_JWKS = sampleJwks;
    process.env.PII_KEYS = JSON.stringify([{ kid: "local", material: sampleKeyMaterial }]);
    process.env.PII_ACTIVE_KEY = "local";
    process.env.PII_SALTS = JSON.stringify([{ sid: "local", secret: sampleSaltMaterial }]);
    process.env.PII_ACTIVE_SALT = "local";
    assert.throws(() => loadConfig(), /DATABASE_URL is required/);
});
