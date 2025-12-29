import Fastify from "fastify";
import { buildFastifyApp } from "../src/app.js";
import { basSettlementRoutes } from "../src/routes/bas-settlement.js";

jest.setTimeout(30000);

type Principal = { id: string; orgId: string; role: string };

function bearer(principal: Principal): string {
  const token = Buffer.from(JSON.stringify(principal), "utf8").toString("base64url");
  return `Bearer ${token}`;
}

describe("/api/settlements/bas auth (via buildFastifyApp)", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = buildFastifyApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/settlements/bas/finalise",
      headers: {
        "x-org-id": "org-demo-1",
        "idempotency-key": "idem-missing-auth-1",
      },
      payload: { period: "2025-Q3" },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("accepts a valid request when authorised (and Idempotency-Key is present)", async () => {
    const app = buildFastifyApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/settlements/bas/finalise",
      headers: {
        authorization: bearer({ id: "user-test-1", orgId: "org-demo-1", role: "user" }),
        "x-org-id": "org-demo-1",
        "idempotency-key": "idem-auth-ok-1",
      },
      payload: { period: "2025-Q3", payload: { note: "test" } },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.period).toBe("2025-Q3");
    expect(body.instructionId).toBeDefined();

    await app.close();
  });
});

describe("BAS settlement route validation (direct routes)", () => {
  it("rejects an invalid period", async () => {
    const app = Fastify({ logger: false });
    await basSettlementRoutes(app as any);
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/finalise",
      headers: {
        "idempotency-key": "idem-invalid-period-1",
        "x-org-id": "org-demo-1",
      },
      payload: { period: "not-a-period" },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("accepts a valid period", async () => {
    const app = Fastify({ logger: false });
    await basSettlementRoutes(app as any);
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/finalise",
      headers: {
        "idempotency-key": "idem-valid-period-1",
        "x-org-id": "org-demo-1",
      },
      payload: { period: "2025-Q3" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.instructionId).toBeDefined();
    expect(body.period).toBe("2025-Q3");

    await app.close();
  });
});
