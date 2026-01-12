import { buildFastifyApp } from "../src/app.js";

describe("health and readiness routes", () => {
  it("/health/live returns ok", async () => {
    const app = buildFastifyApp({ configOverrides: { environment: "test", inMemoryDb: true } });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health/live" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    await app.close();
  });

  it("/health/ready returns ok when DB is reachable", async () => {
    const app = buildFastifyApp({ configOverrides: { environment: "test", inMemoryDb: true } });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health/ready" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, checks: { db: true } });

    await app.close();
  });

  it("/health/ready returns 503 when DB is unreachable", async () => {
    const app = buildFastifyApp({ configOverrides: { environment: "test", inMemoryDb: true } });
    await app.ready();

    (app as any).db = {
      $executeRawUnsafe: async () => {
        throw new Error("db down");
      },
    };

    const res = await app.inject({ method: "GET", url: "/health/ready" });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ ok: false, checks: { db: false } });

    await app.close();
  });
});
