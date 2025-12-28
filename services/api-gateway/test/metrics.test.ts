import { buildFastifyApp } from "../src/app.js";

describe("/metrics", () => {
  it("exposes Prometheus metrics", async () => {
    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "test", inMemoryDb: true },
    });

    await app.ready();

    // Ensure at least one request
    await app.inject({ method: "GET", url: "/health" });

    const res = await app.inject({ method: "GET", url: "/metrics" });

    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/plain");

    const body = res.body;

    // Stable default metric
    expect(body).toContain("process_cpu_user_seconds_total");

    // Custom metric
    expect(body).toContain("apgms_http_requests_total");

    await app.close();
  });
});
