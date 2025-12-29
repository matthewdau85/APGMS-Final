import { buildFastifyApp } from "../src/app.js";

const isProd = process.env.NODE_ENV === "production";

describe("prototype admin-only guard", () => {
  it("rejects access when not admin (403 in non-prod, 404 in prod)", async () => {
    const app = buildFastifyApp();

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      headers: {
        "x-org-id": "org-1",
        "x-role": "user",
      },
    });

    expect(res.statusCode).toBe(isProd ? 404 : 403);

    if (!isProd) {
      expect(res.json()).toEqual({ error: "admin_only_prototype" });
    }

    await app.close();
  });

  it("allows admin access (200 in non-prod, 404 in prod)", async () => {
    const app = buildFastifyApp();

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1&riskBand=LOW",
      headers: {
        "x-org-id": "org-1",
        "x-role": "admin",
      },
    });

    expect(res.statusCode).toBe(isProd ? 404 : 200);

    await app.close();
  });
});
