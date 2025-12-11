import Fastify, { FastifyInstance } from "fastify";
import { buildServer } from "../../src/app";

/**
 * Build a fully wired Fastify app for tests.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(buildServer);
  await app.ready();
  return app;
}
