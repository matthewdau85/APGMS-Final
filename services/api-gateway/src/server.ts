import { createApp } from "./app.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

let draining = false;

async function main(): Promise<void> {
  // build the Fastify app (this does Prisma, CORS, rate-limit, routes, etc)
  const app: FastifyInstance = await createApp();

  //
  // Add /ready here (we keep /health inside createApp)
  //
  app.get(
    "/ready",
    async (_req: FastifyRequest, reply: FastifyReply) => {
      if (draining) {
        app.metrics?.recordSecurityEvent?.("readiness.draining");
        return reply.code(503).send({ ready: false, draining: true });
      }

      // basic DB probe so k8s/docker can tell if we're actually usable
      try {
        await (app as any).prisma?.$queryRaw`SELECT 1`;
      } catch (err) {
        app.log.error({ err }, "readiness_db_check_failed");
        return reply.code(503).send({ ready: false, db: false });
      }

      return reply.send({ ready: true, draining: false, db: true });
    }
  );

  //
  // start server
  //
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await app.listen({ port, host });
    app.log.info({ port, host }, "listening");
  } catch (err) {
    app.log.error({ err }, "fatal_boot_error");
    process.exit(1);
  }

  //
  // graceful shutdown
  //
  async function shutdown(signal: string) {
    if (draining) {
      // already in progress
      return;
    }

    draining = true;
    app.log.warn({ signal }, "received_shutdown_signal");

    try {
      await app.close();
      app.log.info("fastify_closed");
    } catch (err) {
      app.log.error({ err }, "shutdown_error");
    } finally {
      process.exit(0);
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
