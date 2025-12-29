import Fastify from "fastify";
import { basSettlementPlugin } from "../src/routes/bas-settlement";

describe("BAS settlement lifecycle routes (in-memory)", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await basSettlementPlugin(app as any, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("prepare -> 201 with instructionId + payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-Q1", payload: { foo: "bar" } },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.instructionId).toBeDefined();
    expect(body.payload).toEqual({ foo: "bar" });
  });

  it("sent -> 200 and status SENT", async () => {
    // First create a settlement
    const prep = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-Q2" },
    });
    expect(prep.statusCode).toBe(201);
    const { instructionId } = prep.json();

    const res = await app.inject({
      method: "POST",
      url: `/settlements/bas/${instructionId}/sent`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instructionId).toBe(instructionId);
    expect(body.status).toBe("SENT");
  });

  it("ack -> 200 and status ACK", async () => {
    const prep = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-Q3" },
    });
    expect(prep.statusCode).toBe(201);
    const { instructionId } = prep.json();

    const res = await app.inject({
      method: "POST",
      url: `/settlements/bas/${instructionId}/ack`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instructionId).toBe(instructionId);
    expect(body.status).toBe("ACK");
  });

  it("failed -> 200 and status FAILED", async () => {
    const prep = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-Q4" },
    });
    expect(prep.statusCode).toBe(201);
    const { instructionId } = prep.json();

    const res = await app.inject({
      method: "POST",
      url: `/settlements/bas/${instructionId}/failed`,
      payload: { reason: "INSUFFICIENT_FUNDS" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instructionId).toBe(instructionId);
    expect(body.status).toBe("FAILED");
  });

  it("returns 404 when lifecycle target instructionId does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/does-not-exist/sent",
    });

    expect(res.statusCode).toBe(404);
  });

  it("prepare returns 400 for invalid period format", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/settlements/bas/prepare",
      payload: { period: "2025-13" },
    });

    expect(res.statusCode).toBe(400);
  });
});
