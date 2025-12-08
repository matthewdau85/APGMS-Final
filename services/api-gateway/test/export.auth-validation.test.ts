// services/api-gateway/test/export.auth-validation.test.ts

import Fastify from "fastify";
import { registerExportRoutes } from "../src/routes/export";

// Mock authGuard to require auth header
jest.mock("../src/auth", () => ({
  authGuard: (req: any, reply: any, done: any) => {
    if (!req.headers.authorization) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    done();
  },
}));

describe("Export routes – auth and validation", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    await registerExportRoutes(app as any);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when unauthenticated (no Authorization header)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/bas/v1?period=2025-Q1",
      // no auth header
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 on invalid period", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/bas/v1?period=bad",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 200 on valid auth + valid period", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/bas/v1?period=2025-Q1",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.orgId).toBe("org-1");
    expect(body.period).toBe("2025-Q1");
  });
});
