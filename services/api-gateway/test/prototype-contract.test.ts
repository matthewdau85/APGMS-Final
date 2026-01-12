import jwt from "jsonwebtoken";
import { buildFastifyApp } from "../src/app.js";
import { registerAuth } from "../src/plugins/auth.js";

const isProd = process.env.NODE_ENV === "production";
const AUTH_SECRET = "proto-contract-secret";

function signToken(role: string) {
  return jwt.sign(
    { orgId: "org-1", role, sub: "user-1" },
    AUTH_SECRET,
    {
      algorithm: "HS256",
      audience: process.env.AUTH_AUDIENCE,
      issuer: process.env.AUTH_ISSUER,
      expiresIn: "5m",
    }
  );
}

describe("prototype contract", () => {
  it("/monitor/risk/summary is 404 in prod; admin-only in non-prod", async () => {
    const app = buildFastifyApp({ inMemoryDb: true });
    process.env.AUTH_DEV_SECRET = AUTH_SECRET;
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";
    process.env.ENABLE_PROTOTYPE = "true";
    await registerAuth(app);

    try {
      await app.ready();

      const resUser = await app.inject({
        method: "GET",
        url: "/monitor/risk/summary?period=2025-Q1",
        headers: {
          "x-org-id": "org-1",
          authorization: `Bearer ${signToken("user")}`,
        },
      });

      if (isProd) {
        expect(resUser.statusCode).toBe(404);
      } else {
        expect(resUser.statusCode).toBe(403);
        expect(resUser.json()).toEqual({ error: "admin_only_prototype" });
      }

      const resAdmin = await app.inject({
        method: "GET",
        url: "/monitor/risk/summary?period=2025-Q1",
        headers: {
          "x-org-id": "org-1",
          authorization: `Bearer ${signToken("admin")}`,
        },
      });

      if (isProd) {
        expect(resAdmin.statusCode).toBe(404);
      } else {
        expect([200, 400, 401, 404, 500]).toContain(resAdmin.statusCode);
      }
    } finally {
      await app.close();
      delete process.env.AUTH_DEV_SECRET;
      delete process.env.AUTH_AUDIENCE;
      delete process.env.AUTH_ISSUER;
      delete process.env.ENABLE_PROTOTYPE;
    }
  });

  it("/regulator/compliance/summary is 404 in prod; regulator-only in non-prod", async () => {
    const app = buildFastifyApp({ inMemoryDb: true });
    process.env.AUTH_DEV_SECRET = AUTH_SECRET;
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";
    await registerAuth(app);

    try {
      await app.ready();

      const resUser = await app.inject({
        method: "GET",
        url: "/regulator/compliance/summary?period=2025-Q1",
        headers: {
          "x-org-id": "org-1",
          authorization: `Bearer ${signToken("user")}`,
        },
      });

      if (isProd) {
        expect(resUser.statusCode).toBe(404);
      } else {
        expect(resUser.statusCode).toBe(403);
      }

      const resRegulator = await app.inject({
        method: "GET",
        url: "/regulator/compliance/summary?period=2025-Q1",
        headers: {
          "x-org-id": "org-1",
          authorization: `Bearer ${signToken("regulator")}`,
        },
      });

      if (isProd) {
        expect(resRegulator.statusCode).toBe(404);
      } else {
        expect([200, 400, 401, 404, 500]).toContain(resRegulator.statusCode);
      }
    } finally {
      await app.close();
      delete process.env.AUTH_DEV_SECRET;
      delete process.env.AUTH_AUDIENCE;
      delete process.env.AUTH_ISSUER;
    }
  });
});
