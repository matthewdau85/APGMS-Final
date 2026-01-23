// services/api-gateway/src/server.ts
import type { FastifyInstance } from "fastify";
import { buildFastifyApp } from "./app.js";
import { config } from "./config.js";

export async function buildServer(): Promise<FastifyInstance> {
  return buildFastifyApp();
}

export async function startServer(): Promise<void> {
  const app = await buildServer();

  const host = "0.0.0.0";
  const port = (config as unknown as (typeof config & { port: number })).port;

  try {
    await app.listen({ host, port });
    app.log.info({ host, port }, "api-gateway listening");
  } catch (err) {
    app.log.error({ err }, "api-gateway failed to start");
    process.exitCode = 1;
  }
}
