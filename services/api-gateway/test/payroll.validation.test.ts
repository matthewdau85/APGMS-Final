import Fastify from "fastify";
import { registerPayrollRoutes } from "../src/routes/payroll.js";
import { createServices } from "../src/services/index.js";

describe("PAYGW payroll route validation", () => {
  async function buildApp() {
    const app = Fastify({ logger: false });
    app.decorate("services", createServices({ db: {}, metrics: {} }));
    await registerPayrollRoutes(app);
    await app.ready();
    return app;
  }

  it("rejects missing lines", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/org-1/payroll/simulate",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error?.code).toBe("invalid_payload");
    expect(body.error?.details.some((detail: any) => detail.path === "lines")).toBe(true);

    await app.close();
  });

  it("rejects unknown keys in body", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/org-1/payroll/simulate",
      payload: {
        basPeriodId: "2025-Q1",
        lines: [
          {
            id: "line-1",
            employeeId: "emp-1",
            gross: 1000,
            taxWithheld: 100,
            superannuation: 50,
          },
        ],
        extra: "nope",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error?.code).toBe("invalid_payload");
    expect(Array.isArray(body.error?.details)).toBe(true);
    expect(body.error?.details.length).toBeGreaterThan(0);

    await app.close();
  });

  it("allows valid payload", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/org-1/payroll/simulate",
      payload: {
        basPeriodId: "2025-Q1",
        lines: [
          {
            id: "line-1",
            employeeId: "emp-1",
            gross: 1000,
            taxWithheld: 100,
            superannuation: 50,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe("paygw");

    await app.close();
  });
});
