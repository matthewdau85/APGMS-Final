import jwt from "jsonwebtoken";
import { buildFastifyApp } from "../src/app";

process.env.AUTH_DEV_SECRET = process.env.AUTH_DEV_SECRET ?? "local-dev-shared-secret-change-me";
process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE ?? "apgms-api";
process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? "https://issuer.example";

const SECRET = process.env.AUTH_DEV_SECRET!;
const AUDIENCE = process.env.AUTH_AUDIENCE!;
const ISSUER = process.env.AUTH_ISSUER!;

function signToken(payload: Record<string, any>) {
  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: "10m",
  });
}

describe("BAS finalise idempotency", () => {
  it("replays the original response for duplicate Idempotency-Key", async () => {
    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "test", inMemoryDb: true },
    });

    await app.ready();

    const token = signToken({ sub: "user-1", orgId: "org-demo-1" });

    const first = await app.inject({
      method: "POST",
      url: "/api/settlements/bas/finalise",
      headers: {
        authorization: `Bearer ${token}`,
        "x-org-id": "org-demo-1",
        "idempotency-key": "idem-1",
      },
      payload: { period: "2025-Q3", payload: { amount: 123 } },
    });

    expect(first.statusCode).toBe(201);
    const firstBody = first.json();
    expect(firstBody.instructionId).toBeDefined();

    const second = await app.inject({
      method: "POST",
      url: "/api/settlements/bas/finalise",
      headers: {
        authorization: `Bearer ${token}`,
        "x-org-id": "org-demo-1",
        "idempotency-key": "idem-1",
      },
      payload: { period: "2025-Q3", payload: { amount: 123 } },
    });

    expect(second.statusCode).toBe(201);
    const secondBody = second.json();
    expect(secondBody).toEqual(firstBody);

    await app.close();
  });

  it("returns 409 if the same Idempotency-Key is reused with a different payload", async () => {
    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "test", inMemoryDb: true },
    });

    await app.ready();

    const token = signToken({ sub: "user-1", orgId: "org-demo-1" });

    const first = await app.inject({
      method: "POST",
      url: "/api/settlements/bas/finalise",
      headers: {
        authorization: `Bearer ${token}`,
        "x-org-id": "org-demo-1",
        "idempotency-key": "idem-2",
      },
      payload: { period: "2025-Q3", payload: { amount: 123 } },
    });

    expect(first.statusCode).toBe(201);

    const conflict = await app.inject({
      method: "POST",
      url: "/api/settlements/bas/finalise",
      headers: {
        authorization: `Bearer ${token}`,
        "x-org-id": "org-demo-1",
        "idempotency-key": "idem-2",
      },
      payload: { period: "2025-Q3", payload: { amount: 999 } },
    });

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({ error: "idempotency_conflict" });

    await app.close();
  });
});
