import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";

/**
 * Build a fully wired Fastify app for tests.
 */
export async function buildApp(): Promise<FastifyInstance> {
  return createApp();
}
