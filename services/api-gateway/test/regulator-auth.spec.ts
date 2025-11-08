import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Fastify from "fastify";

const envDefaults: Record<string, string> = {
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

for (const [key, value] of Object.entries(envDefaults)) {
  if (!process.env[key] || process.env[key]!.trim().length === 0) {
    process.env[key] = value;
  }
}

const [{ AppError }, { registerRegulatorAuthRoutes }] = await Promise.all([
  import("@apgms/shared"),
  import("../src/routes/regulator-auth.js"),
]);

describe("/regulator/login validation", () => {
  const app = Fastify();

  before(async () => {
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof AppError) {
        reply
          .status(error.status)
          .send({ error: { code: error.code, message: error.message, fields: error.fields } });
        return;
      }

      if ((error as any)?.validation) {
        reply.status(400).send({
          error: { code: "invalid_body", message: "Validation failed" },
        });
        return;
      }

      reply.status(500).send({
        error: { code: "internal_error", message: "Internal server error" },
      });
    });

    await registerRegulatorAuthRoutes(app);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("rejects requests without an accessCode", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: {},
    });

    assert.equal(response.statusCode, 400);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, "invalid_body");
  });

  it("rejects whitespace access codes before hitting downstream dependencies", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: "   " },
    });

    assert.equal(response.statusCode, 400);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, "invalid_body");
  });

  it("rejects incorrect access codes with an access_denied error", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: "wrong" },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, "access_denied");
  });
});
