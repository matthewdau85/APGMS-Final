import { buildServer } from "../src/app";

describe("health and readiness routes", () => {
  it("/health returns ok with service name", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      service: "api-gateway",
    });

    await app.close();
  });

  it("/ready returns ok when DB is healthy and not draining", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(200);
    // New simplified shape: no components block any more
    expect(res.json()).toEqual({ ok: true });

    await app.close();
  });

  it("/ready returns 503 when server is draining", async () => {
    const app: any = await buildServer();

    // Use the helper we attach in app.ts
    app.setDraining(true);

    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      ok: false,
      draining: true,
    });

    await app.close();
  });
});
