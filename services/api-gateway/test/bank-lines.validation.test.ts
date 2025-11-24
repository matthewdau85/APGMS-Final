import Fastify from "fastify";
import { createBankLinesPlugin } from "../src/routes/bank-lines";

const mockUser = { orgId: "org-1", sub: "user-1", role: "admin" };
const makeApp = (user: any) => {
  const prisma = {
    bankLine: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const app = Fastify();
  app.decorateRequest("user", null);
  app.addHook("onRequest", (req, _rep, done) => {
    (req as any).user = user;
    done();
  });
  app.register(createBankLinesPlugin({ prisma } as any));
  return { app, prisma };
};

describe("bank-lines validation/auth/idempotency", () => {
  it("401 when unauthenticated", async () => {
    const { app } = makeApp(null);
    const res = await app.inject({ method: "POST", url: "/bank-lines", payload: {} });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("400 invalid body", async () => {
    const { app } = makeApp(mockUser);
    const res = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: { idempotencyKey: "", amount: "abc" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("idempotent replay returns header", async () => {
    const { app, prisma } = makeApp(mockUser);
    const payload = {
      idempotencyKey: "idem-1",
      amount: 123.45,
      date: "2025-01-01",
      payeeCiphertext: "c",
      payeeKid: "k",
      descCiphertext: "dc",
      descKid: "dk",
    };
    prisma.bankLine.findUnique.mockResolvedValueOnce(null);
    prisma.bankLine.create.mockResolvedValueOnce({ ...payload, id: "bl-1", orgId: "org-1", createdAt: new Date(), date: new Date() });
    prisma.bankLine.findUnique.mockResolvedValueOnce({ ...payload, id: "bl-1", orgId: "org-1", createdAt: new Date(), date: new Date() });

    const first = await app.inject({ method: "POST", url: "/bank-lines", payload });
    expect(first.statusCode).toBe(201);
    expect(first.headers["idempotent-replay"]).toBe("false");

    const second = await app.inject({ method: "POST", url: "/bank-lines", payload });
    expect(second.statusCode).toBe(201);
    expect(second.headers["idempotent-replay"]).toBe("true");
    await app.close();
  });

  it("403 when role not allowed", async () => {
    const { app } = makeApp({ ...mockUser, role: "viewer" });
    const res = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        idempotencyKey: "idem-2",
        amount: 1,
        date: "2025-01-01",
        payeeCiphertext: "c",
        payeeKid: "k",
        descCiphertext: "dc",
        descKid: "dk",
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
