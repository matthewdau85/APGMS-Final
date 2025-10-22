import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";

const ALLOWED_ORIGIN = "https://frontend.example.test";
const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests";

let app: FastifyInstance;
let originalAllowedOrigins: string | undefined;

beforeEach(async () => {
  originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;

  app = await createApp({ prisma: createPrismaStub() });
  await app.ready();
});

afterEach(async () => {
  process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  await app.close();
});

test("allows configured origins and exposes CORS/CSP headers", async () => {
  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/health",
    headers: {
      origin: ALLOWED_ORIGIN,
      "access-control-request-method": "GET",
    },
  });

  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], ALLOWED_ORIGIN);
  assert.equal(preflight.headers["access-control-allow-credentials"], "true");
  assert.match(String(preflight.headers["access-control-allow-methods"]), /GET/);

  const response = await app.inject({
    method: "GET",
    url: "/health",
    headers: { origin: ALLOWED_ORIGIN },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["access-control-allow-origin"], ALLOWED_ORIGIN);
  assert.equal(response.headers["content-security-policy"], EXPECTED_CSP);
});

test("rejects disallowed origins", async () => {
  const response = await app.inject({
    method: "OPTIONS",
    url: "/health",
    headers: {
      origin: "https://malicious.example", // not in allow-list
      "access-control-request-method": "GET",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
});

function createPrismaStub(): PrismaClient {
  const stub = {
    org: {
      findUnique: async () => null,
      update: async () => ({}) as any,
    },
    user: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
    bankLine: {
      findMany: async () => [],
      create: async () => ({}) as any,
      deleteMany: async () => ({ count: 0 }),
      upsert: async () => ({}) as any,
    },
    orgTombstone: {
      create: async () => ({}) as any,
    },
    $transaction: async <T>(run: (tx: typeof stub) => Promise<T>) => run(stub as any),
    $queryRaw: async () => 1,
  } as const;

  return stub as unknown as PrismaClient;
}
