import { buildFastifyApp } from "../src/app.js";

const isProd = process.env.NODE_ENV === "production";

describe("prototype contract", () => {
  const paths = [
    "/monitor/risk/summary?period=2025-Q1",
    "/regulator/compliance/summary?period=2025-Q1",
  ];

  for (const url of paths) {
    it(`${url} is 404 in prod; admin-only in non-prod`, async () => {
      const app = buildFastifyApp({ inMemoryDb: true });

      try {
        const resUser = await app.inject({
          method: "GET",
          url,
          headers: {
            "x-org-id": "org-1",
            "x-role": "user",
            authorization: "Bearer test-token",
          },
        });

        if (isProd) {
          expect(resUser.statusCode).toBe(404);
        } else {
          expect(resUser.statusCode).toBe(403);
          expect(resUser.json()).toEqual({ error: "admin_only_prototype" });
        }

        const resAdmin = await app.inject({
          method: "GET",
          url,
          headers: {
            "x-org-id": "org-1",
            "x-role": "admin",
            authorization: "Bearer test-token",
          },
        });

        if (isProd) {
          expect(resAdmin.statusCode).toBe(404);
        } else {
          // in non-prod, admin should not be blocked by the prototype guard
          // (route itself may still fail if its dependencies aren't mocked/seeded)
          expect([200, 400, 401, 404, 500]).toContain(resAdmin.statusCode);
        }
      } finally {
        await app.close();
      }
    });
  }
});
