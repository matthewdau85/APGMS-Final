import { buildFastifyApp } from "../src/app.js";

describe("CORS allowlist in production", () => {
  it("throws when allowlist is empty in production", () => {
    delete process.env.CORS_ALLOWED_ORIGINS;

    expect(() => {
      buildFastifyApp({ configOverrides: { environment: "production", inMemoryDb: true } });
    }).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it("accepts only listed origins in production", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example,https://console.example";

    const app = buildFastifyApp({ configOverrides: { environment: "production", inMemoryDb: true } });
    await app.ready();

    const allowed = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "https://app.example",
        "access-control-request-method": "GET",
      },
    });
    expect(allowed.statusCode).not.toBe(403);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.example");

    const blocked = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "GET",
      },
    });
    expect(blocked.statusCode).toBe(403);

    await app.close();
  });
});
