import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";

const buildApp = async () => {
  const prismaStub: Partial<PrismaClient> = {
    org: {
      findUnique: async () => null,
      update: async () => null,
    } as any,
    user: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    } as any,
    bankLine: {
      findMany: async () => [],
      upsert: async () => {
        throw new Error("should not upsert on invalid payload");
      },
      create: async () => {
        throw new Error("should not create on invalid payload");
      },
      deleteMany: async () => ({ count: 0 }),
    } as any,
    orgTombstone: {
      create: async () => ({}),
    } as any,
    $transaction: (async (fn: any) => fn(prismaStub)) as any,
    $queryRaw: (async () => 1) as any,
  };

  const app = await createApp({ prisma: prismaStub as PrismaClient });
  await app.ready();
  return app;
};

test("400 on invalid bank-line payload", async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { authorization: "Bearer TEST_ADMIN" },
    payload: { idempotencyKey: "x", amount: "NaN" },
  });

  assert.equal(res.statusCode, 400);
  const body = res.json();
  assert.equal(body.error, "Bad Request");

  await app.close();
});
