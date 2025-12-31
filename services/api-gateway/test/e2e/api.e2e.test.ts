import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildFastifyApp } from "../../src/app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildFastifyApp({ inMemoryDb: true });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

it("responds to /health", async () => {
  const res = await app.inject({ method: "GET", url: "/health" });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ ok: true });
});
