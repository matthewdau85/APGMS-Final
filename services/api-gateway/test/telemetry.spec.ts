import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";
import {
  getActiveSpanExporter,
  shutdownTelemetry,
  SemanticAttributes,
  type InMemorySpanExporter,
} from "../src/telemetry";

describe("telemetry", () => {
  let app: FastifyInstance;
  let exporter: InMemorySpanExporter;

  beforeEach(async () => {
    await shutdownTelemetry();
    process.env.JWT_SECRET = "test-secret";
    process.env.OTEL_TRACES_EXPORTER = "memory";

    const prismaStub = createPrismaStub();
    app = await createApp({ prisma: prismaStub });
    await app.ready();

    const activeExporter = getActiveSpanExporter();
    assert.ok(activeExporter, "telemetry did not expose an in-memory exporter");
    exporter = activeExporter;
    exporter.reset();
  });

  afterEach(async () => {
    await app.close();
    await shutdownTelemetry();
    delete process.env.OTEL_TRACES_EXPORTER;
  });

  it("propagates correlation IDs and records HTTP/DB spans", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: { "x-request-id": "req-123" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-request-id"], "req-123");

    const spans = exporter.getFinishedSpans();
    const httpSpan = spans.find((span) => span.name === "http.server");
    assert.ok(httpSpan, "http.server span was not recorded");
    assert.equal(httpSpan?.attributes["http.request_id"], "req-123");

    const dbSpan = spans.find((span) =>
      typeof span.name === "string" && span.name.startsWith("prisma.")
    );
    assert.ok(dbSpan, "prisma span was not recorded");
    assert.equal(dbSpan?.attributes["http.request_id"], "req-123");
    assert.equal(dbSpan?.attributes[SemanticAttributes.DB_SYSTEM], "postgresql");
  });
});

function createPrismaStub(): PrismaClient {
  const stub: any = {
    async $queryRaw() {
      return 1;
    },
    user: {
      async findUnique() {
        return null;
      },
      async findMany() {
        return [];
      },
    },
    bankLine: {
      async findMany() {
        return [];
      },
      async count() {
        return 0;
      },
      async upsert() {
        return null;
      },
      async create() {
        return null;
      },
      async deleteMany() {
        return { count: 0 };
      },
    },
    org: {
      async findUnique() {
        return null;
      },
      async update() {
        return null;
      },
    },
    orgTombstone: {
      async create() {
        return null;
      },
    },
  };

  stub.$transaction = async (fn: (tx: typeof stub) => unknown) => {
    return fn(stub);
  };

  return stub as PrismaClient;
}
