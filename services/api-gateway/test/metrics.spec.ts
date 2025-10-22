import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { createApp } from "../src/app";

let app: FastifyInstance;

describe("/metrics", () => {
  before(async () => {
    process.env.JWT_SECRET ??= "test-secret";
    const prismaStub: any = {
      user: { findUnique: async () => null, findMany: async () => [] },
      bankLine: { findMany: async () => [] },
      org: { findUnique: async () => null },
      orgTombstone: {},
      $transaction: async (cb: any) => cb(prismaStub),
      $queryRaw: async () => 1,
    };
    app = await createApp({ prisma: prismaStub });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("exposes Prometheus metrics", async () => {
    const healthResponse = await app.inject({ method: "GET", url: "/health" });
    assert.equal(healthResponse.statusCode, 200);

    const response = await app.inject({ method: "GET", url: "/metrics" });
    assert.equal(response.statusCode, 200);
    const contentType = response.headers["content-type"];
    assert.ok(typeof contentType === "string" && contentType.includes("text/plain"));

    const body = response.body;
    assert.ok(body.includes("api_http_requests_total"));
    assert.ok(body.includes("api_http_request_duration_seconds_sum"));
  });
});
