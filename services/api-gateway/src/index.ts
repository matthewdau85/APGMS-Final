import { createApp } from "./app";

let draining = false;

async function main() {
  // spin up Fastify + routes + plugins
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
        // lightweight "is DB alive?" probe
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
  // NOTE: /health is already registered in createApp()
  //       (returns { ok: true, service: "api-gateway" })
  //

  // pick up PORT from env, fallback -> 3000
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // VERY IMPORTANT: host "0.0.0.0" so it's reachable from the host machine,
  // not just inside the container.
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
