import { afterEach, describe, expect, it, jest } from "@jest/globals";

const baseEnv = {
  DATABASE_URL: "postgres://localhost:5432/apgms-test",
  AUTH_AUDIENCE: "test-audience",
  AUTH_ISSUER: "https://issuer.test",
  AUTH_DEV_SECRET: "dev-secret",
  AUTH_JWKS: JSON.stringify({ keys: [{ kid: "kid-1", alg: "RS256" }] }),
  PII_KEYS: JSON.stringify([
    { kid: "kid-1", material: Buffer.alloc(32, 1).toString("base64") },
  ]),
  PII_ACTIVE_KEY: "kid-1",
  PII_SALTS: JSON.stringify([
    { sid: "sid-1", secret: Buffer.alloc(32, 2).toString("base64") },
  ]),
  PII_ACTIVE_SALT: "sid-1",
  ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 3).toString("base64"),
  TAX_ENGINE_URL: "http://tax-engine.test",
  REGULATOR_ACCESS_CODE: "access-code",
  WEBAUTHN_ORIGIN: "http://localhost:5173",
};

const applyEnv = () => {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(baseEnv)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
};

import type { FastifyInstance } from "fastify";

type ProviderState = {
  redis: { ping: jest.Mock<Promise<unknown>, []> } | null;
  nats: { flush: jest.Mock<Promise<unknown>, []> } | null;
};

async function buildTestServer(providers: ProviderState, queryRawImpl?: () => Promise<unknown>) {
  jest.resetModules();

  const restoreEnv = applyEnv();

  const promClient = await import("prom-client");
  promClient.register.clear();

  const queryRaw = jest.fn(queryRawImpl ?? (async () => 1));
  const db = await import("../src/db.js");
  const previousUse = db.prisma.$use;
  const previousQueryRaw = db.prisma.$queryRaw;
  db.prisma.$use = jest.fn();
  db.prisma.$queryRaw = queryRaw as typeof db.prisma.$queryRaw;

  const initProviders = jest.fn().mockResolvedValue(providers);
  const closeProviders = jest.fn().mockResolvedValue(undefined);

  const providersModule = await import("../src/providers.js");
  const previousInit = providersModule.initProviders;
  const previousClose = providersModule.closeProviders;
  providersModule.initProviders = initProviders as typeof providersModule.initProviders;
  providersModule.closeProviders = closeProviders as typeof providersModule.closeProviders;

  const { buildServer } = await import("../src/app.js");
  const app = await buildServer();
  await app.ready();

  restoreEnv();

  const restoreStubs = () => {
    db.prisma.$use = previousUse;
    db.prisma.$queryRaw = previousQueryRaw;
    providersModule.initProviders = previousInit;
    providersModule.closeProviders = previousClose;
  };

  return { app, queryRaw, initProviders, closeProviders, restoreStubs };
}

describe("/ready integration", () => {
  const apps: FastifyInstance[] = [];
  const cleanupFns: Array<() => void> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop();
      if (app) {
        await app.close();
      }
    }
    while (cleanupFns.length > 0) {
      const fn = cleanupFns.pop();
      fn?.();
    }
  });

  it("reports optional dependencies as null when not configured", async () => {
    const { app, queryRaw, restoreStubs } = await buildTestServer({ redis: null, nats: null });
    apps.push(app);
    cleanupFns.push(restoreStubs);

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(queryRaw).toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      components: { db: true, redis: null, nats: null },
    });
  });

  it("fails readiness when a configured provider is unhealthy", async () => {
    const redis = { ping: jest.fn().mockRejectedValue(new Error("redis down")) };
    const nats = { flush: jest.fn().mockResolvedValue(undefined) };

    const { app, queryRaw, restoreStubs } = await buildTestServer({ redis, nats });
    apps.push(app);
    cleanupFns.push(restoreStubs);

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(queryRaw).toHaveBeenCalled();
    expect(redis.ping).toHaveBeenCalled();
    expect(nats.flush).toHaveBeenCalled();
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      components: { db: true, redis: false, nats: true },
    });
  });
});
