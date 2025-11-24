import Fastify from "fastify";

import { registerTransferRoutes } from "../src/routes/transfers";
import { prisma } from "../src/db";
import { markTransferStatus } from "@apgms/shared";
import { recordCriticalAuditLog } from "../src/lib/audit";

jest.mock("../src/db", () => ({
  prisma: {
    idempotencyEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../src/observability/metrics", () => ({
  metrics: {
    transferExecutionTotal: { inc: jest.fn() },
  },
}));

jest.mock("@apgms/shared", () => ({
  markTransferStatus: jest.fn(),
  conflict: (code: string, message: string) =>
    Object.assign(new Error(`${code}:${message}`), { code }),
}));

jest.mock("../src/lib/audit", () => ({
  recordCriticalAuditLog: jest.fn(),
}));

const mockUser = { orgId: "org-1", sub: "user-1", role: "admin" };

const makeApp = (user: any) => {
  const app = Fastify();
  app.decorateRequest("user", null as any);
  app.addHook("onRequest", (req, _rep, done) => {
    (req as any).user = user;
    done();
  });
  app.register(registerTransferRoutes);
  return app;
};

describe("transfers validation/auth/idempotency", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("401 when unauthenticated", async () => {
    const app = makeApp(null);
    const res = await app.inject({
      method: "POST",
      url: "/bas/transfer",
      payload: { instructionId: "abc", mfaCode: "0000" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("403 when role missing", async () => {
    const app = makeApp({ orgId: "org-1", sub: "user-1" });
    const res = await app.inject({
      method: "POST",
      url: "/bas/transfer",
      payload: { instructionId: "abc", mfaCode: "0000" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("400 on invalid body", async () => {
    const app = makeApp(mockUser);
    const res = await app.inject({
      method: "POST",
      url: "/bas/transfer",
      payload: { instructionId: "", mfaCode: "0" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("idempotent replay returns header", async () => {
    const app = makeApp(mockUser);
    (prisma as any).idempotencyEntry.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "ide-1" });
    (prisma as any).idempotencyEntry.create.mockResolvedValueOnce({ id: "ide-1" });
    (prisma as any).idempotencyEntry.update.mockResolvedValue({});
    (markTransferStatus as jest.Mock).mockResolvedValue(undefined);
    (recordCriticalAuditLog as jest.Mock).mockResolvedValue(undefined);

    const payload = { instructionId: "inst-1", mfaCode: "0000" };
    const first = await app.inject({
      method: "POST",
      url: "/bas/transfer",
      payload,
      headers: { "idempotency-key": "idem-1" },
    });
    expect(first.statusCode).toBe(200);
    expect(first.headers["idempotent-replay"]).toBe("false");

    const second = await app.inject({
      method: "POST",
      url: "/bas/transfer",
      payload,
      headers: { "idempotency-key": "idem-1" },
    });
    expect(second.statusCode).toBe(409);
    expect(second.headers["idempotent-replay"]).toBe("true");
    await app.close();
  });

  it("happy path sends transfer", async () => {
    const app = makeApp(mockUser);
    (prisma as any).idempotencyEntry.findUnique.mockResolvedValueOnce(null);
    (prisma as any).idempotencyEntry.create.mockResolvedValueOnce({ id: "ide-2" });
    (prisma as any).idempotencyEntry.update.mockResolvedValue({});
    (markTransferStatus as jest.Mock).mockResolvedValue(undefined);
    (recordCriticalAuditLog as jest.Mock).mockResolvedValue(undefined);

    const res = await app.inject({
      method: "POST",
      url: "/bas/transfer",
      payload: { instructionId: "inst-2", mfaCode: "0000" },
      headers: { "idempotency-key": "idem-2" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["idempotent-replay"]).toBe("false");
    expect(markTransferStatus).toHaveBeenCalledWith("inst-2", "sent");
    await app.close();
  });
});
