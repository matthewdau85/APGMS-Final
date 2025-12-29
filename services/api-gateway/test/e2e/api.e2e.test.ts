// services/api-gateway/test/e2e/api.e2e.test.ts

import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildFastifyApp } from "../../src/app.js";

describe("api e2e smoke", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildFastifyApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("responds to /health", async () => {
    const res = await request(app.server).get("/health").send();
    expect([200, 204]).toContain(res.status);
  });
});
