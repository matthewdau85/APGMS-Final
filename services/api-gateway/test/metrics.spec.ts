import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";

type MetricsStub = {
  client: PrismaClient;
};

function createMetricsStub(): MetricsStub {
  const prisma = {
    $queryRaw: async () => 1,
    $disconnect: async () => {},
    org: { findUnique: async () => null, update: async () => null },
    user: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    bankLine: {
      findMany: async () => [],
      create: async () => ({
        id: "line",
        orgId: "",
        date: new Date(),
        amount: 0,
        payee: "",
        desc: "",
        createdAt: new Date(),
      }),
      deleteMany: async () => ({ count: 0 }),
    },
    orgTombstone: { create: async () => ({}) },
    $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => callback(prisma),
  } as unknown as PrismaClient;

  return { client: prisma };
}

let app: FastifyInstance;

afterEach(async () => {
  if (app) {
    await app.close();
  }
});

test("/metrics returns counters and histograms per route", async () => {
  const stub = createMetricsStub();
  app = await createApp({ prisma: stub.client });
  await app.ready();

  const healthResponse = await app.inject({ method: "GET", url: "/health" });
  assert.equal(healthResponse.statusCode, 200);

  const metricsResponse = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(metricsResponse.statusCode, 200);
  assert.equal(metricsResponse.headers["content-type"], "text/plain; version=0.0.4; charset=utf-8");
  const body = metricsResponse.body;
  assert.ok(body.includes('http_requests_total{method="GET",route="/health",status_code="200"} 1'));
  assert.ok(body.includes("http_request_duration_seconds_bucket"));
  assert.ok(body.includes('http_request_duration_seconds_count{method="GET",route="/health",status_code="200"} 1'));
});
