// services/api-gateway/test/ingest-csv.auth-validation.test.ts

import Fastify from "fastify";
import { registerIngestCsvRoutes } from "../src/routes/ingest-csv";

jest.mock("../src/auth", () => ({
  authGuard: (req: any, reply: any, done: any) => {
    if (!req.headers.authorization) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    done();
  },
}));

describe("Ingest CSV – auth and validation", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    await registerIngestCsvRoutes(app as any);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ingest/csv",
      payload: { period: "2025-Q1", rows: [] },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for invalid period", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ingest/csv",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
      payload: { period: "bad", rows: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 202 and ingestedRows on valid payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ingest/csv",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
      payload: {
        period: "2025-Q1",
        rows: [{ some: "row" }, { some: "other" }],
      },
    });

    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.orgId).toBe("org-1");
    expect(body.period).toBe("2025-Q1");
    expect(body.ingestedRows).toBe(2);
  });
});
