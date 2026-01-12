import Fastify from "fastify";
import { registerGstRoutes } from "../src/routes/gst.js";
import { createServices } from "../src/services/index.js";

describe("GST POS route validation", () => {
  async function buildApp() {
    const app = Fastify({ logger: false });
    app.decorate("services", createServices({ db: {}, metrics: {} }));
    await registerGstRoutes(app);
    await app.ready();
    return app;
  }

  const validTransaction = {
    id: "tx-1",
    date: new Date().toISOString(),
    amount: 1000,
    gstAmount: 100,
  };

  it("rejects missing transactions", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/org-1/pos/transactions",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error?.details.some((detail: any) => detail.path === "transactions")).toBe(true);

    await app.close();
  });

  it("rejects extra keys", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/org-1/pos/transactions",
      payload: {
        transactions: [validTransaction],
        extra: "bad",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(Array.isArray(body.error?.details)).toBe(true);
    expect(body.error?.details.length).toBeGreaterThan(0);

    await app.close();
  });

  it("allows valid payload", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/org-1/pos/transactions",
      payload: {
        transactions: [validTransaction],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe("gst");

    await app.close();
  });
});
