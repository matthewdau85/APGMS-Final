// services/api-gateway/test/bas-settlement.lifecycle.test.ts

import Fastify from "fastify";
import { registerBasSettlementRoutes } from "../src/routes/bas-settlement";
import {
  prepareBasSettlementInstruction,
  markBasSettlementSent,
  markBasSettlementAck,
  markBasSettlementFailed,
} from "@apgms/domain-policy/settlement/bas-settlement";

// Mock authGuard similarly to other tests
jest.mock("../src/auth", () => ({
  authGuard: (req: any, reply: any, done: any) => {
    if (!req.headers.authorization) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    if (req.headers["x-org-id"]) {
      req.org = { orgId: req.headers["x-org-id"] };
    }
    done();
  },
}));

jest.mock("@apgms/domain-policy/settlement/bas-settlement", () => ({
  prepareBasSettlementInstruction: jest.fn().mockResolvedValue({
    id: "settlement-1",
    status: "PREPARED",
    payloadJson: { foo: "bar" },
  }),
  markBasSettlementSent: jest.fn().mockResolvedValue({
    id: "settlement-1",
    status: "SENT",
  }),
  markBasSettlementAck: jest.fn().mockResolvedValue({
    id: "settlement-1",
    status: "ACK",
  }),
  markBasSettlementFailed: jest.fn().mockResolvedValue({
    id: "settlement-1",
    status: "FAILED",
  }),
}));

const mockedPrepare = prepareBasSettlementInstruction as jest.MockedFunction<
  typeof prepareBasSettlementInstruction
>;
const mockedSent = markBasSettlementSent as jest.MockedFunction<
  typeof markBasSettlementSent
>;
const mockedAck = markBasSettlementAck as jest.MockedFunction<
  typeof markBasSettlementAck
>;
const mockedFailed = markBasSettlementFailed as jest.MockedFunction<
  typeof markBasSettlementFailed
>;

describe("BAS settlement lifecycle routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    await registerBasSettlementRoutes(app as any);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockedPrepare.mockClear();
    mockedSent.mockClear();
    mockedAck.mockClear();
    mockedFailed.mockClear();
  });

  it("returns 401 when unauthenticated on prepare", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-Q1" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("prepare → 201 with instructionId + payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
      payload: { period: "2025-Q1" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.instructionId).toBe("settlement-1");
    expect(body.payload).toEqual({ foo: "bar" });

    expect(mockedPrepare).toHaveBeenCalledWith("org-1", "2025-Q1");
  });

  it("sent → 200 and status SENT", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/settlement-1/sent",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instructionId).toBe("settlement-1");
    expect(body.status).toBe("SENT");
    expect(mockedSent).toHaveBeenCalledWith("settlement-1");
  });

  it("ack → 200 and status ACK", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/settlement-1/ack",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instructionId).toBe("settlement-1");
    expect(body.status).toBe("ACK");
    expect(mockedAck).toHaveBeenCalledWith("settlement-1");
  });

  it("failed → 200 and status FAILED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/settlement-1/failed",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
      payload: { reason: "INSUFFICIENT_FUNDS" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instructionId).toBe("settlement-1");
    expect(body.status).toBe("FAILED");
    expect(mockedFailed).toHaveBeenCalledWith(
      "settlement-1",
      "INSUFFICIENT_FUNDS",
    );
  });
});
