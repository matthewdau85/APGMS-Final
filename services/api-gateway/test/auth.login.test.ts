const prevNodeEnv = process.env.NODE_ENV;
const prevCors = process.env.CORS_ALLOWED_ORIGINS;

afterAll(() => {
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;

  if (prevCors === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
  else process.env.CORS_ALLOWED_ORIGINS = prevCors;
});

describe("/auth/login gating", () => {
  async function buildProdServer() {
    jest.resetModules();
    process.env.NODE_ENV = "production";
    process.env.CORS_ALLOWED_ORIGINS = "http://allowed.example";

    const mod = await import("../src/server");
    return mod.buildServer();
  }

  test("returns 404 in production even with dev flag", async () => {
    const server = await buildProdServer();

    const res = await server.inject({
      method: "POST",
      url: "/auth/login",
      headers: { origin: "http://allowed.example" },
      payload: { username: "x", password: "y", dev: true },
    });

    expect(res.statusCode).toBe(404);
    await server.close();
  });
});
