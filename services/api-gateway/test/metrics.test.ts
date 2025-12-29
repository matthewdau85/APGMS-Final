import { buildFastifyApp } from "../src/app.js";

describe("/metrics", () => {
  it("exposes Prometheus metrics", async () => {
    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "test", inMemoryDb: true },
    });

    await app.ready();

    await app.inject({ method: "GET", url: "/health" });

    const res = await app.inject({ method: "GET", url: "/metrics" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");

    const body = res.body;

    expect(body).toContain("process_cpu_user_seconds_total");
    expect(body).toContain("apgms_http_requests_total");
    expect(body).toContain("apgms_db_query_duration_seconds");

    await app.close();
  });
});
