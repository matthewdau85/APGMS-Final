import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { buildFastifyApp } from "../src/app.js";
import { basSettlementRoutes } from "../src/routes/bas-settlement.js";

jest.setTimeout(30000);

function signToken() {
  // Keep test self-contained and not dependent on developer machine env.
  const AUDIENCE = process.env.AUTH_AUDIENCE ?? "apgms-api";
  const ISSUER = process.env.AUTH_ISSUER ?? "https://issuer.example";
  const SECRET = process.env.AUTH_DEV_SECRET ?? "local-dev-shared-secret-change-me";

  return jwt.sign(
    { sub: "user-test-1", orgId: "org-demo-1", role: "user" },
    SECRET,
    { algorithm: "HS256", audience: AUDIENCE, issuer: ISSUER, expiresIn: "1h" }
  );
}

// ---------------------------------------------------------------------------
// Auth behaviour via full app (secure scope)
// ---------------------------------------------------------------------------

describe("/api/settlements/bas auth (via buildFastifyApp)", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "test", inMemoryDb: true },
    });

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
    // Ensure auth defaults exist for jwt verification
    process.env.AUTH_DEV_SECRET = process.env.AUTH_DEV_SECRET ?? "local-dev-shared-secret-change-me";
    process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE ?? "apgms-api";
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? "https://issuer.example";

    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "test", inMemoryDb: true },
    });

    await app.ready();

    const token = signToken();

    const res = await app.inject({
      method: "POST",
      url: "/api/settlements/bas/finalise",
      headers: {
        authorization: `Bearer ${token}`,
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

// ---------------------------------------------------------------------------
// Schema/validation behaviour via direct route registration (no auth)
// ---------------------------------------------------------------------------

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
