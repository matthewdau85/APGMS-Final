import Fastify from "fastify";
import { registerBasRoutes } from "../src/routes/bas.js";

jest.mock("@apgms/shared", () => {
  const actualShared = jest.requireActual("@apgms/shared");
  return {
    ...actualShared,
    recordBasLodgment: jest.fn(async () => ({ id: "lodgment-1" })),
    finalizeBasLodgment: jest.fn(async () => undefined),
    createTransferInstruction: jest.fn(async () => undefined),
    createPaymentPlanRequest: jest.fn(async () => undefined),
  };
});

const {
  recordBasLodgment: recordBasLodgmentMock,
  finalizeBasLodgment: finalizeBasLodgmentMock,
  createTransferInstruction: createTransferInstructionMock,
  createPaymentPlanRequest: createPaymentPlanRequestMock,
} = jest.requireMock("@apgms/shared");

describe("BAS lodgment validation", () => {
let app: ReturnType<typeof Fastify> | undefined;

  const buildApp = async () => {
    const instance = Fastify({ logger: false });
    instance.addHook("preHandler", (req, _reply, done) => {
      (req as any).user = { orgId: "org-1", role: "admin", sub: "user-1" };
      done();
    });
    await registerBasRoutes(instance);
    await instance.ready();
    return instance;
  };

  beforeEach(() => {
    recordBasLodgmentMock.mockReset();
    finalizeBasLodgmentMock.mockReset();
    createTransferInstructionMock.mockReset();
    createPaymentPlanRequestMock.mockReset();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("rejects unknown query keys", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/bas/lodgment?foo=bar",
      payload: { initiatedBy: "tester" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error?.details.some((detail: any) => detail.message.includes("Unrecognized key(s)"))).toBe(true);
  });

  it("rejects unknown body keys", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/bas/lodgment?basCycleId=2025-Q1",
      payload: { initiatedBy: "tester", extra: "bad" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error?.details.some((detail: any) => detail.message.includes("Unrecognized key(s)"))).toBe(true);
  });

  it("allows valid requests", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/bas/lodgment?basCycleId=2025-Q1",
      payload: { initiatedBy: "tester" },
    });

    expect(res.statusCode).toBe(200);
    expect(recordBasLodgmentMock).toHaveBeenCalled();
  });
});
