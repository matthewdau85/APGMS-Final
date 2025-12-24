import { buildFastifyApp } from "../src/app.js";

describe("/metrics", () => {
  it("exposes Prometheus metrics", async () => {
    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "test", inMemoryDb: true },
    });

    await app.ready();

    // Make at least one request so the HTTP counter has a sample line
    await app.inject({ method: "GET", url: "/health" });

    const res = await app.inject({ method: "GET", url: "/metrics" });

    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/plain");

    const body = res.body;

    // Default metric from prom-client (stable)
    expect(body).toContain("process_cpu_user_seconds_total");

    // Our custom metric
    expect(body).toContain("apgms_http_requests_total");

    await app.close();
  });
});
