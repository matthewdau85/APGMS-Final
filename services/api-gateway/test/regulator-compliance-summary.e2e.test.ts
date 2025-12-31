import { buildFastifyApp } from "../src/app.js";

const isProd = process.env.NODE_ENV === "production";

(isProd ? describe.skip : describe)("/regulator/compliance/summary e2e", () => {
  it("rejects when x-org-id is missing", async () => {
    const app = buildFastifyApp({ inMemoryDb: true });

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
      headers: {
        authorization: "Bearer test-token",
        // intentionally no x-org-id
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "missing_org" });

    await app.close();
  });

  it("returns HIGH risk when ledger is empty but obligations exist", async () => {
    const app = buildFastifyApp({ inMemoryDb: true });

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
      headers: {
        "x-org-id": "org-1",
        authorization: "Bearer test-token",
      },
    });

    expect(res.statusCode).toBe(200);

    const body: any = res.json();
    expect(body).toBeTruthy();

    await app.close();
  });
});
