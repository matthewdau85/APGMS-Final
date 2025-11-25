// services/api-gateway/test/regulator-compliance-summary.test.ts

import fastify from "fastify";
import helmet from "@fastify/helmet";
import { buildHelmetConfig } from "../src/security-headers";
import { registerRegulatorComplianceSummaryRoute } from "../src/routes/regulator-compliance-summary";
import type { AppConfig } from "../src/config";
import { Buffer } from "node:buffer";

const baseConfig: AppConfig = {
  env: "test",
  databaseUrl: "postgres://user:pass@localhost:5432/testdb",
  shadowDatabaseUrl: undefined,
  rateLimit: {
    max: 60,
    window: "1 minute",
  },
  security: {
    authFailureThreshold: 5,
    kmsKeysetLoaded: true,
    requireHttps: false,
  },
  cors: {
    allowedOrigins: ["http://localhost:5173"],
  },
  taxEngineUrl: "http://tax-engine:8000",
  auth: {
    audience: "test-audience",
    issuer: "https://auth.localhost",
    devSecret: "local-dev-secret",
  },
  regulator: {
    accessCode: "test-code",
    jwtAudience: "urn:apgms:regulator",
    sessionTtlMinutes: 60,
  },
  encryption: {
    masterKey: Buffer.alloc(32),
  },
  webauthn: {
    rpId: "localhost",
    rpName: "APGMS Test",
    origin: "http://localhost:5173",
  },
  banking: {
    providerId: "mock",
    maxReadTransactions: 1000,
    maxWriteCents: 5_000_000,
  },
  redis: undefined,
  nats: undefined,
};

describe("/regulator/compliance/summary", () => {
  it("returns a compliant demo payload", async () => {
    const app = fastify();

    await app.register(helmet, buildHelmetConfig(baseConfig));
    await registerRegulatorComplianceSummaryRoute(app, baseConfig);

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      generatedAt: string;
      items: Array<{ orgId: string; riskBand: string }>;
    };

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).toHaveProperty("orgId");
    expect(body.items[0]).toHaveProperty("riskBand");
  });
});
