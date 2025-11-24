import Fastify from "fastify";

import { registerPaymentPlanRoutes } from "../src/routes/payment-plans";
import {
  createPaymentPlanRequest,
  listPaymentPlans,
  updatePaymentPlanStatus,
} from "@apgms/shared";
import { prisma } from "../src/db";

jest.mock("../src/auth", () => ({
  authGuard: (_req: any, _reply: any, done: () => void) => done(),
}));

jest.mock("@apgms/shared", () => ({
  createPaymentPlanRequest: jest.fn(),
  listPaymentPlans: jest.fn(),
  updatePaymentPlanStatus: jest.fn(),
  buildPaymentPlanNarrative: jest.fn().mockReturnValue("summary"),
}));

jest.mock("../src/db", () => ({
  prisma: {
    paymentPlanRequest: {
      findUnique: jest.fn(),
    },
  },
}));

const mockUser = { orgId: "org-1", sub: "user-1", role: "admin" };

const makeApp = (user: any) => {
  const app = Fastify();
  app.decorateRequest("user", null as any);
  app.addHook("onRequest", (req, _rep, done) => {
    (req as any).user = user;
    done();
  });
  app.register(registerPaymentPlanRoutes);
  return app;
};

describe("payment plans validation/auth", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (listPaymentPlans as jest.Mock).mockResolvedValue([]);
    (createPaymentPlanRequest as jest.Mock).mockResolvedValue({ id: "pp-1" });
    (updatePaymentPlanStatus as jest.Mock).mockResolvedValue({ id: "pp-1", status: "APPROVED" });
    (prisma as any).paymentPlanRequest.findUnique.mockResolvedValue({
      id: "pp-1",
      orgId: "org-1",
      basCycleId: "bas-1",
      reason: "Need a plan",
      status: "REQUESTED",
      detailsJson: {},
      requestedAt: new Date(),
    });
  });

  it("401 when unauthenticated", async () => {
    const app = makeApp(null);
    const res = await app.inject({ method: "GET", url: "/payment-plans" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("403 when role missing", async () => {
    const app = makeApp({ orgId: "org-1", sub: "user-1" });
    const res = await app.inject({ method: "GET", url: "/payment-plans" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("400 on invalid creation body", async () => {
    const app = makeApp(mockUser);
    const res = await app.inject({
      method: "POST",
      url: "/payment-plans",
      payload: { basCycleId: "", reason: "short" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("happy path creates payment plan", async () => {
    const app = makeApp(mockUser);
    const res = await app.inject({
      method: "POST",
      url: "/payment-plans",
      payload: { basCycleId: "bas-1", reason: "Need more time", details: { note: true } },
    });
    expect(res.statusCode).toBe(201);
    expect(createPaymentPlanRequest).toHaveBeenCalled();
    await app.close();
  });

  it("403 when accessing another org summary", async () => {
    const app = makeApp(mockUser);
    (prisma as any).paymentPlanRequest.findUnique.mockResolvedValueOnce({
      id: "pp-2",
      orgId: "other-org",
      basCycleId: "bas-2",
      reason: "Other org",
      status: "REQUESTED",
      detailsJson: {},
      requestedAt: new Date(),
    });
    const res = await app.inject({ method: "GET", url: "/payment-plans/pp-2/summary" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
