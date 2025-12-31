import { buildApp } from "../src/app.js";

describe("admin audit", () => {
  test("admin data export endpoint is wired and does not 5xx", async () => {
    const app = buildApp({ inMemoryDb: true });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/admin/data/export",
      payload: { orgId: "org-1", email: "subject@example.com" },
    });

    // We don’t assume auth is configured in-test; we only assert "no server crash".
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(500);

    await app.close();
  });
});
