import { buildFastifyApp } from "../src/app.js";

describe("health and readiness routes", () => {
  it("/health returns ok", async () => {
    const app = buildFastifyApp({ configOverrides: { environment: "test", inMemoryDb: true } });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    await app.close();
  });

  it("/ready returns ok", async () => {
    const app = buildFastifyApp({ configOverrides: { environment: "test" } });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    await app.close();
  });
});
