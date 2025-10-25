import { createApp } from "./app";

let draining = false;

async function main() {
  const app = await createApp();

  // modify /ready to respect draining:
  app.get("/ready", async (_req, reply) => {
    if (draining) {
      app.metrics?.recordSecurityEvent("readiness.draining");
      return reply.code(503).send({ ready: false, draining: true });
    }

    try {
      await app.config.healthcheckDb(app); // optional hook: or just prisma.$queryRaw`SELECT 1`
      app.metrics?.recordSecurityEvent("readiness.ok");
      return reply.code(200).send({ ready: true });
    } catch (err) {
      app.log.warn({ err }, "readiness check failed");
      app.metrics?.recordSecurityEvent("readiness.fail");
      return reply.code(503).send({ ready: false });
    }
  });

  const address = process.env.PORT ?? "3000";
  await app.listen({ port: Number(address), host: "0.0.0.0" });
  app.log.info(`api-gateway listening on ${address}`);

  const shutdown = async () => {
    if (draining) return; // already in progress
    draining = true;
    app.log.info("draining_start");
    try {
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
  console.error("fatal_boot_error", err);
  process.exit(1);
});
