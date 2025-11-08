import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { computePayloadHash } from "@apgms/shared";

type PrismaStub = {
  idempotencyEntry: {
    findUnique: jest.Mock<Promise<
      | {
          actorId: string;
          requestHash: string;
          statusCode: number;
          responsePayload: unknown;
          responseHash: string;
          resource?: string | null;
          resourceId?: string | null;
        }
      | null
    >, [unknown]>;
    create: jest.Mock<Promise<void>, [unknown]>;
  };
};

const prismaStub: PrismaStub = {
  idempotencyEntry: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

class FakeReply {
  statusCode: number | undefined;
  payload: unknown;
  headers: Record<string, string> = {};

  header(name: string, value: string) {
    this.headers[name] = value;
    return this;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  send(payload: unknown) {
    this.payload = payload;
    return this;
  }
}

async function loadWithIdempotency() {
  jest.resetModules();
  const module = await import("../src/lib/idempotency.js");
  return module.withIdempotency;
}

describe("withIdempotency integration", () => {
  beforeEach(() => {
    prismaStub.idempotencyEntry.findUnique.mockReset();
    prismaStub.idempotencyEntry.create.mockReset();
  });

  it("persists the response payload for a new idempotency key", async () => {
    const withIdempotency = await loadWithIdempotency();
    const request = {
      headers: { "idempotency-key": "req-1" },
      body: { amount: 100 },
    } as unknown as FastifyRequest;
    const rawReply = new FakeReply();
    const reply = rawReply as unknown as FastifyReply;

    prismaStub.idempotencyEntry.findUnique.mockResolvedValueOnce(null);
    prismaStub.idempotencyEntry.create.mockResolvedValueOnce();

    const handler = jest.fn(async () => ({
      statusCode: 201,
      body: { id: "line-1" },
      resource: "bank-line",
      resourceId: "line-1",
    }));

    const result = await withIdempotency(
      request,
      reply,
      {
        prisma: prismaStub as unknown as any,
        orgId: "org-1",
        actorId: "actor-1",
        requestPayload: { amount: 100 },
        resource: "bank-line",
      },
      handler,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(prismaStub.idempotencyEntry.create).toHaveBeenCalledTimes(1);
    expect(rawReply.headers["Idempotent-Replay"]).toBe("false");
    expect(reply.statusCode).toBe(201);
    expect(result).toEqual({ replayed: false, body: { id: "line-1" } });
  });

  it("replays the stored response when the key and payload match", async () => {
    const withIdempotency = await loadWithIdempotency();
    const payload = { amount: 55 };
    const request = {
      headers: { "idempotency-key": "req-2" },
      body: payload,
    } as unknown as FastifyRequest;
    const rawReply = new FakeReply();
    const reply = rawReply as unknown as FastifyReply;

    const requestHash = computePayloadHash(payload);

    prismaStub.idempotencyEntry.findUnique.mockResolvedValueOnce({
      actorId: "actor-2",
      requestHash,
      statusCode: 202,
      responsePayload: { id: "existing" },
      responseHash: computePayloadHash({ id: "existing" }),
      resource: "bank-line",
      resourceId: "existing",
    });

    const handler = jest.fn();

    const result = await withIdempotency(
      { ...request, headers: { "idempotency-key": "req-2" } } as FastifyRequest,
      reply,
      { prisma: prismaStub as unknown as any, orgId: "org-2", actorId: "actor-2" },
      handler,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(rawReply.headers["Idempotent-Replay"]).toBe("true");
    expect(reply.statusCode).toBe(202);
    expect(result).toEqual({ replayed: true, body: { id: "existing" } });
  });

  it("rejects when the request is missing an idempotency key", async () => {
    const withIdempotency = await loadWithIdempotency();
    const request = { headers: {} } as unknown as FastifyRequest;
    const reply = new FakeReply() as unknown as FastifyReply;
    const handler = jest.fn();

    await expect(
      withIdempotency(
        request,
        reply,
        { prisma: prismaStub as unknown as any, orgId: "org-1", actorId: "actor-1" },
        handler,
      ),
    ).rejects.toMatchObject({ code: "missing_idempotency_key" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("detects conflicting replays when actor or payload differs", async () => {
    const withIdempotency = await loadWithIdempotency();
    const payload = { amount: 42 };
    const request = {
      headers: { "idempotency-key": "conflict" },
      body: payload,
    } as unknown as FastifyRequest;
    const reply = new FakeReply() as unknown as FastifyReply;

    prismaStub.idempotencyEntry.findUnique.mockResolvedValueOnce({
      actorId: "other-actor",
      requestHash: "different",
      statusCode: 202,
      responsePayload: { id: "existing" },
      responseHash: computePayloadHash({ id: "existing" }),
      resource: null,
      resourceId: null,
    });

    await expect(
      withIdempotency(
        request,
        reply,
        { prisma: prismaStub as unknown as any, orgId: "org-3", actorId: "actor-3", requestPayload: payload },
        jest.fn(),
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });

    expect(prismaStub.idempotencyEntry.findUnique).toHaveBeenCalledTimes(1);
  });

  it("replays the persisted response when a P2002 conflict occurs", async () => {
    const withIdempotency = await loadWithIdempotency();
    const payload = { amount: 75 };
    const request = {
      headers: { "idempotency-key": "replay" },
      body: payload,
    } as unknown as FastifyRequest;
    const rawReply = new FakeReply();
    const reply = rawReply as unknown as FastifyReply;

    const requestHash = computePayloadHash(payload);

    prismaStub.idempotencyEntry.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        actorId: "actor-4",
        requestHash,
        statusCode: 200,
        responsePayload: { ok: true },
        responseHash: computePayloadHash({ ok: true }),
        resource: "bank-line",
        resourceId: "line-42",
      });

    prismaStub.idempotencyEntry.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("P2002"));

    const handler = jest.fn(async () => ({ statusCode: 200, body: { ok: true } }));

    const result = await withIdempotency(
      request,
      reply,
      { prisma: prismaStub as unknown as any, orgId: "org-4", actorId: "actor-4", requestPayload: payload },
      handler,
    );

    expect(result).toEqual({ replayed: true, body: { ok: true } });
    expect(rawReply.headers["Idempotent-Replay"]).toBe("true");
    expect(reply.statusCode).toBe(200);
  });

  it("rethrows unexpected persistence errors", async () => {
    const withIdempotency = await loadWithIdempotency();
    const request = {
      headers: { "idempotency-key": "unexpected" },
      body: { amount: 10 },
    } as unknown as FastifyRequest;
    const reply = new FakeReply() as unknown as FastifyReply;

    prismaStub.idempotencyEntry.findUnique.mockResolvedValueOnce(null);
    prismaStub.idempotencyEntry.create.mockRejectedValueOnce(new Error("boom"));

    await expect(
      withIdempotency(
        request,
        reply,
        { prisma: prismaStub as unknown as any, orgId: "org-5", actorId: "actor-5" },
        async () => ({ statusCode: 201, body: { created: true } }),
      ),
    ).rejects.toThrow("boom");
  });
});
