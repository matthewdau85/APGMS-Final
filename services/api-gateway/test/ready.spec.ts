import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";

type ReadyStubOptions = {
  healthy: boolean;
};

type ReadyStub = {
  client: PrismaClient;
};

function createReadyStub(options: ReadyStubOptions): ReadyStub {
  const prisma = {
    $queryRaw: async () => {
      if (!options.healthy) {
        throw new Error("db unavailable");
      }
      return 1;
    },
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

test("GET /ready returns 200 when the database is reachable", async () => {
  const stub = createReadyStub({ healthy: true });
  app = await createApp({ prisma: stub.client });
  await app.ready();

  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});

test("GET /ready returns 503 when the database is unavailable", async () => {
  const stub = createReadyStub({ healthy: false });
  app = await createApp({ prisma: stub.client });
  await app.ready();

  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { ok: false });
});
