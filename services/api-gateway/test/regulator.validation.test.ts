import Fastify from "fastify";

import { registerRegulatorRoutes } from "../src/routes/regulator";

jest.mock("../src/db", () => ({ prisma: {} }));

const now = new Date();
const stubPrisma = {
  basCycle: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  paymentPlanRequest: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  alert: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  },
  designatedAccount: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  monitoringSnapshot: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  evidenceArtifact: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  bankLine: {
    aggregate: jest.fn().mockResolvedValue({ _count: { id: 0 }, _sum: { amount: 0 } }),
    findFirst: jest.fn().mockResolvedValue({ id: "bl-1", orgId: "org-1", date: now, amount: 1, createdAt: now }),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const makeApp = (auth?: { user?: any; regulatorSession?: any }) => {
  const app = Fastify();
  app.decorateRequest("user", null as any);
  app.decorateRequest("regulatorSession", null as any);
  app.addHook("onRequest", (req, reply, done) => {
    if (!auth) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    if (!auth.regulatorSession && auth.user?.role !== "regulator") {
      reply.code(403).send({ error: "forbidden" });
      return;
    }
    (req as any).user = auth.user;
    (req as any).regulatorSession = auth.regulatorSession;
    done();
  });
  app.register(async (regScope) => {
    await registerRegulatorRoutes(regScope, { prisma: stubPrisma as any, auditLogger: async () => {} });
  }, { prefix: "/regulator" });
  return app;
};

describe("regulator route validation/auth", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    stubPrisma.basCycle.findMany.mockResolvedValue([]);
    stubPrisma.basCycle.findFirst.mockResolvedValue(null);
    stubPrisma.paymentPlanRequest.findMany.mockResolvedValue([]);
    stubPrisma.alert.count.mockResolvedValue(0);
    stubPrisma.alert.findMany.mockResolvedValue([]);
    stubPrisma.designatedAccount.findMany.mockResolvedValue([]);
    stubPrisma.monitoringSnapshot.findMany.mockResolvedValue([]);
    stubPrisma.evidenceArtifact.findMany.mockResolvedValue([]);
    stubPrisma.evidenceArtifact.findUnique.mockResolvedValue(null);
    stubPrisma.bankLine.aggregate.mockResolvedValue({ _count: { id: 0 }, _sum: { amount: 0 } });
    stubPrisma.bankLine.findFirst.mockResolvedValue({
      id: "bl-1",
      orgId: "org-1",
      date: now,
      amount: 1,
      createdAt: now,
    });
    stubPrisma.bankLine.findMany.mockResolvedValue([]);
  });

  it("401 when unauthenticated", async () => {
    const app = makeApp(undefined);
    const res = await app.inject({ method: "GET", url: "/regulator/health" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("403 when wrong role", async () => {
    const app = makeApp({ user: { orgId: "org-1", sub: "user-1", role: "admin" } });
    const res = await app.inject({ method: "GET", url: "/regulator/health" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("400 on invalid query", async () => {
    const app = makeApp({ regulatorSession: { id: "sess-1", orgId: "org-1" } });
    const res = await app.inject({ method: "GET", url: "/regulator/monitoring/snapshots?limit=0" });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("happy path returns reports", async () => {
    const app = makeApp({ regulatorSession: { id: "sess-1", orgId: "org-1" } });
    const res = await app.inject({ method: "GET", url: "/regulator/compliance/report" });
    expect(res.statusCode).toBe(200);
    expect(res.json().orgId).toBe("org-1");
    await app.close();
  });
});
