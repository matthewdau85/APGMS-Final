const prevNodeEnv = process.env.NODE_ENV;
const prevCors = process.env.CORS_ALLOWED_ORIGINS;

afterAll(() => {
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;

  if (prevCors === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
  else process.env.CORS_ALLOWED_ORIGINS = prevCors;
});

describe("prototype endpoints disabled in production", () => {
  async function buildProdApp() {
    jest.resetModules();
    process.env.NODE_ENV = "production";
    process.env.CORS_ALLOWED_ORIGINS = "http://allowed.example";

    const mod = await import("../src/app");
    return mod.buildFastifyApp();
  }

  test("returns 404 for regulator compliance summary in production (even if headers are guessed)", async () => {
    const app = await buildProdApp();

    const res = await app.inject({
      method: "GET",
      url: "/prototype/regulator-compliance-summary",
      headers: {
        origin: "http://allowed.example",
        "x-forwarded-host": "evil.example",
      },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
