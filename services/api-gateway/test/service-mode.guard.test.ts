import Fastify from "fastify";
import { basSettlementPlugin } from "../src/routes/bas-settlement";
import { setServiceMode, _resetServiceModeForTests } from "../src/service-mode";

describe("service mode guard", () => {
  beforeEach(() => {
    _resetServiceModeForTests();
  });

  it("allows writes in normal mode", async () => {
    const app = Fastify({ logger: false });
    await basSettlementPlugin(app as any);
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-Q1" },
    });

    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it("blocks writes when suspended (503)", async () => {
    const app = Fastify({ logger: false });
    await basSettlementPlugin(app as any);
    await app.ready();

    setServiceMode("suspended", { by: "test", reason: "incident" });

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-Q1" },
    });

    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("blocks writes when read-only (409)", async () => {
    const app = Fastify({ logger: false });
    await basSettlementPlugin(app as any);
    await app.ready();

    setServiceMode("read-only", { by: "test", reason: "maintenance" });

    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-Q1" },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });
});
