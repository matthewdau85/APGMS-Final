import { buildServer } from "./app.js";
import { startTracing, stopTracing } from "./observability/tracing.js";


const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

async function main() {
  await startTracing();

  const app = await buildServer();

  const shutdown = async (signal: string) => {
    try {
      app.log.info({ signal }, "shutdown_start");
        try {
          // @ts-expect-error custom decorator defined in app.ts
          app.setDraining?.(true);
        } catch (decoratorErr) {
          app.log.warn({ decoratorErr }, "drain-flag-not-set");
        }
      await app.close();
      await stopTracing();
      app.log.info("shutdown_complete");
    } catch (err) {
      app.log.error({ err }, "shutdown_error");
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await app.listen({ port, host });
  app.log.info({ url: `http://${host}:${port}` }, "api-gateway_up");
}

main().catch(async (err) => {
  console.error("fatal_startup_error", err);
  await stopTracing();
  process.exit(1);
});
