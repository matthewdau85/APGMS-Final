import { buildFastifyApp } from "../src/app.js";

describe("CORS allowlist in production", () => {
  const prev = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(() => {
    process.env.CORS_ALLOWED_ORIGINS = prev;
  });

  it("rejects a non-allowlisted Origin with 403 in production", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://allowed.example";

    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "production", inMemoryDb: true },
    });

    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://evil.example",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "cors_origin_forbidden" });

    await app.close();
  });

  it("allows an allowlisted Origin and sets Access-Control-Allow-Origin in production", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://allowed.example";

    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "production", inMemoryDb: true },
    });

    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://allowed.example",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example");

    await app.close();
  });
});
