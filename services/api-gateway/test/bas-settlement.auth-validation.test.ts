// services/api-gateway/test/bas-settlement.auth-validation.test.ts

import Fastify from "fastify";
import { buildServer } from "../src/app";
import { basSettlementRoutes } from "../src/routes/bas-settlement";
import { exportRoutes } from "../src/routes/export";
import { csvIngestRoutes } from "../src/routes/ingest-csv";

// ---- Auth behaviour via full app (secure scope) ----

describe("/api/bas-settlement auth and validation (via buildServer)", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = await buildServer();

    const res = await app.inject({
      method: "POST",
      url: "/api/settlements/bas/finalise",
      payload: {
        period: "2025-Q3",
      },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

// ---- Route-level validation tests (no full auth) ----

function buildRouteServer() {
  const app = Fastify();

  app.decorateRequest("org", null);
  app.addHook("preHandler", async (req: any) => {
    // Simple fake org for route-level tests
    req.org = { orgId: "org-1" };
  });

  basSettlementRoutes(app);
  exportRoutes(app);
  csvIngestRoutes(app, {} as any);

  return app;
}

describe("BAS settlement route validation", () => {
  it("returns 400 for malformed payload (missing period)", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/finalise",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 for invalid period format", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/finalise",
      payload: {
        period: "2025-13", // fails ^YYYY-(Q1-4|01-12)$
      },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("accepts a valid period", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/finalise",
      payload: {
        period: "2025-Q3",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.instructionId).toBeDefined();

    await app.close();
  });
});

describe("Export routes validation", () => {
  it("returns 400 when period is missing", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "GET",
      url: "/export/bas.csv",
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 when period is invalid", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "GET",
      url: "/export/bas.csv?period=bad",
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("accepts a valid period", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "GET",
      url: "/export/bas.csv?period=2025-Q2",
    });

    expect(res.statusCode).toBe(200);

    await app.close();
  });
});

describe("CSV ingest route validation", () => {
  it("returns 400 for malformed payload (missing required fields)", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "POST",
      url: "/ingest/csv",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 for invalid period format", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "POST",
      url: "/ingest/csv",
      payload: {
        period: "2025-99",
        rows: [],
      },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("accepts valid period and rows array", async () => {
    const app = buildRouteServer();

    const res = await app.inject({
      method: "POST",
      url: "/ingest/csv",
      payload: {
        period: "2025-Q4",
        rows: [{ id: 1 }, { id: 2 }],
      },
    });

    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.status).toBe("accepted");
    expect(body.ingestedRows).toBe(2);

    await app.close();
  });
});
