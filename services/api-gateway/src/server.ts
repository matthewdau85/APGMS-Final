import { createApp } from "./app.js";

let draining = false;

async function main() {
  // Build the Fastify instance + plugins + routes
  const app = await createApp();

  //
  // /ready: readiness + drain state + DB probe
  //
  app.get("/ready", async (_req, reply) => {
    if (draining) {
      app.metrics?.recordSecurityEvent("readiness.draining");
      return reply.code(503).send({ ready: false, draining: true });
    }

    try {
      // dependency liveness (DB ping)
      if (app.prisma) {
        // lightweight "is DB alive?" query
        await app.prisma.$queryRaw`SELECT 1`;
      }

      app.metrics?.recordSecurityEvent("readiness.ok");
      return reply.code(200).send({ ready: true });
    } catch (err) {
      app.log.warn({ err }, "readiness check failed");
      app.metrics?.recordSecurityEvent("readiness.fail");
      return reply.code(503).send({ ready: false });
    }
  });

  //
  // NOTE: /health is already defined inside createApp()
  //   GET /health -> { ok: true, service: "api-gateway" }
  //

  // pick up PORT from env, fallback -> 3000
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // CRUCIAL: bind to 0.0.0.0, not 127.0.0.1
  // Otherwise Docker can’t publish the port to Windows host
  await app.listen({ port, host: "0.0.0.0" });

  app.log.info(`api-gateway listening on :${port}`);

  //
  // graceful shutdown / drain
  //
  const shutdown = async () => {
    if (draining) return;
    draining = true;
    app.log.info("draining_start");
    try {
      // Fastify will stop accepting new reqs and finish in-flight ones
      await app.close();
      app.log.info("draining_complete");
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "draining_failed");
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("fatal_boot_error", err);
  process.exit(1);
});
