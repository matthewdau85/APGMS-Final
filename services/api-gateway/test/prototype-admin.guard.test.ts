import { buildFastifyApp } from "../src/app.js";
import { registerAuth } from "../src/plugins/auth.js";
import jwt from "jsonwebtoken";

const isProd = process.env.NODE_ENV === "production";
const AUTH_SECRET = "proto-admin-secret";

function signToken(role: string) {
  return jwt.sign(
    { orgId: "org-1", role, sub: "user-1" },
    AUTH_SECRET,
    {
      algorithm: "HS256",
      audience: process.env.AUTH_AUDIENCE,
      issuer: process.env.AUTH_ISSUER,
      expiresIn: "5m",
    },
  );
}

describe("prototype admin-only guard", () => {
  beforeEach(() => {
    process.env.AUTH_DEV_SECRET = AUTH_SECRET;
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";
    process.env.ENABLE_PROTOTYPE = "true";
  });

  afterEach(() => {
    delete process.env.AUTH_DEV_SECRET;
    delete process.env.AUTH_AUDIENCE;
    delete process.env.AUTH_ISSUER;
    delete process.env.ENABLE_PROTOTYPE;
  });

  it("rejects access when not admin (403 in non-prod, 404 in prod)", async () => {
    const app = buildFastifyApp({ inMemoryDb: true });
    await registerAuth(app);
    await app.ready();

    const token = signToken("user");
    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      headers: {
        "x-org-id": "org-1",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(isProd ? 404 : 403);

    if (!isProd) {
      expect(res.json()).toEqual({ error: "admin_only_prototype" });
    }

    await app.close();
  });

  it("allows admin access (200 in non-prod, 404 in prod)", async () => {
    const app = buildFastifyApp({ inMemoryDb: true });
    await registerAuth(app);
    await app.ready();

    const token = signToken("admin");
    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1&riskBand=LOW",
      headers: {
        "x-org-id": "org-1",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(isProd ? 404 : 200);

    await app.close();
  });
});
