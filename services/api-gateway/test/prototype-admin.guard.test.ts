import Fastify from "fastify";
import { buildFastifyApp } from "../src/app.js";

describe("prototype admin-only guard", () => {
  it("rejects access when not admin", async () => {
    const app = buildFastifyApp();

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      headers: {
        "x-org-id": "org-1",
        "x-role": "user",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      error: "admin_only_prototype",
    });

    await app.close();
  });

  it("allows admin access", async () => {
    const app = buildFastifyApp();

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1&riskBand=LOW",
      headers: {
        "x-org-id": "org-1",
        "x-role": "admin",
      },
    });

    expect(res.statusCode).toBe(200);

    await app.close();
  });
});
