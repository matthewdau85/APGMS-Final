import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { Buffer } from "node:buffer";

import { helmetConfigFor } from "../src/security-headers";
import type { AppConfig } from "../src/config";

const testConfig: AppConfig = {
  env: "test",
  databaseUrl: "postgres://test:test@localhost:5432/testdb",
  shadowDatabaseUrl: undefined,
  rateLimit: {
    max: 60,
    window: "1 minute",
  },
  security: {
    authFailureThreshold: 5,
    kmsKeysetLoaded: true,
    requireHttps: false,
    enableIsolation: false,
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
    accessCode: "test-access-code",
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

describe("security headers runtime", () => {
  it("registers helmet and cors and applies headers at runtime", async () => {
    const app = Fastify();

    await app.register(cors, {
      origin: testConfig.cors.allowedOrigins,
    });

    await app.register(helmet, helmetConfigFor(testConfig));

    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
    });

    expect(res.statusCode).toBe(200);

    const headers = res.headers;
    // Basic helmet expectations
    expect(headers["x-dns-prefetch-control"]).toBe("off");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
  });
});
