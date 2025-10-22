import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app";

type FastifyApp = Awaited<ReturnType<typeof createApp>>;

let app: FastifyApp | undefined;
let prismaStub: any;

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
  delete process.env.REDIS_URL;
  delete process.env.OTEL_TRACES_EXPORTER;
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.OTEL_COLLECTOR_HEALTHCHECK_URL;

  prismaStub = {
    user: { findUnique: async () => null, findMany: async () => [] },
    bankLine: { findMany: async () => [] },
    org: { findUnique: async () => null },
    orgTombstone: {},
    $transaction: async (cb: any) => cb(prismaStub),
    $queryRaw: async () => 1,
  };
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

test("/ready reports all dependencies healthy", async () => {
  let callCount = 0;
  const httpClient = async () => {
    callCount += 1;
    return { ok: true, status: 200 } as const;
  };
  app = await createApp({
    httpClient: httpClient as any,
    dependencyChecks: [
      {
        name: "queue",
        check: async () => {
          return Promise.resolve();
        },
      },
    ],
    prisma: prismaStub,
  });
  await app.ready();

  const res = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    ready: true,
    dependencies: [
      { name: "database", healthy: true },
      { name: "otel_collector", healthy: true },
      { name: "queue", healthy: true },
    ],
  });
  assert.equal(callCount, 1);
});

test("/ready marks unhealthy dependencies", async () => {
  const httpClient = async () => ({ ok: true, status: 200 } as const);
  app = await createApp({
    httpClient: httpClient as any,
    dependencyChecks: [
      {
        name: "queue",
        check: async () => {
          throw new Error("queue_down");
        },
      },
    ],
    prisma: prismaStub,
  });
  await app.ready();

  const res = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.json(), {
    ready: false,
    dependencies: [
      { name: "database", healthy: true },
      { name: "otel_collector", healthy: true },
      { name: "queue", healthy: false, error: "queue_down" },
    ],
  });
});
