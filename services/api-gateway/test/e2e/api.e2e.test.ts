import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildFastifyApp } from "../../src/app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildFastifyApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});
