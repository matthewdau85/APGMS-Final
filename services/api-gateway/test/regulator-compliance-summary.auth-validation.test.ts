// services/api-gateway/test/regulator-compliance-summary.auth-validation.test.ts

import { buildApp } from "../helpers/build-app"; // whatever you use to construct Fastify app

describe("GET /regulator/compliance/summary auth & validation", () => {
  it("returns 400 when x-org-id is missing", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code ?? body.error).toMatch(/missing_org/i);
  });

  it("returns 400 for invalid period format", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=bad",
      headers: { "x-org-id": "org-test" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code ?? body.error).toMatch(/invalid_period/i);
  });
});
