import { buildFastifyApp } from "../src/app.js";

describe("prototype endpoints disabled in production", () => {
  it("returns 404 for regulator compliance summary in production (even if headers are guessed)", async () => {
    process.env.ENABLE_PROTOTYPE = "true";

    const app = buildFastifyApp({
      logger: false,
      configOverrides: { environment: "production", inMemoryDb: true },
    });

    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q3",
      headers: {
        // even if an attacker guesses these, the route must not exist in prod
        "x-org-id": "org-demo-1",
        authorization: "Bearer admin",
      },
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
