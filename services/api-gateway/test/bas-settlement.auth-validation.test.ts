import Fastify from "fastify";
import { buildFastifyApp } from "../src/app";
import { basSettlementRoutes } from "../src/routes/bas-settlement";

jest.setTimeout(30000);


// ---- Auth behaviour via full app (secure scope) ----

describe("/api/settlements/bas auth (via buildFastifyApp)", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = buildFastifyApp({ configOverrides: { environment: "test", inMemoryDb: true } });
    await app.ready();

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

  // Route-only validation: no auth hook here
  basSettlementRoutes(app as any);

  return app;
}

describe("BAS settlement route validation", () => {
  it("returns 400 for malformed payload (missing period)", async () => {
    const app = buildRouteServer();
    await app.ready();

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
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/finalise",
      payload: {
        period: "2025-13",
      },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("accepts a valid period", async () => {
    const app = buildRouteServer();
    await app.ready();

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
    expect(body.period).toBe("2025-Q3");

    await app.close();
  });
});
