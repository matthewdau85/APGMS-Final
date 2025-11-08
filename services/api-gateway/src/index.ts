import { buildServer } from "./app.js";
import { initTracing, shutdownTracing } from "./observability/tracing.js";

async function bootstrap(): Promise<void> {
  let tracingInitialised = false;

  if (process.env.OTEL_SDK_DISABLED !== "true") {
    try {
      await initTracing();
      tracingInitialised = true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("failed to initialise tracing", error);
    }
  }

  const app = await buildServer();

  if (tracingInitialised) {
    app.addHook("onClose", async () => {
      await shutdownTracing();
    });
  }

  const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of shutdownSignals) {
    process.once(signal, (received) => {
      app.log.info({ signal: received }, "received shutdown signal");
      app
        .close()
        .catch((error) => {
          app.log.error({ err: error }, "error during shutdown");
        })
        .finally(() => {
          void shutdownTracing().catch((tracingError) => {
            app.log.error({ err: tracingError }, "error stopping tracing");
          });
          process.exit(0);
        });
    });
  }

  process.on("unhandledRejection", (error) => {
    app.log.error({ err: error }, "unhandled rejection");
  });

  try {
    await app.listen({
      port: 3000,
      host: "0.0.0.0",
    });
    app.log.info("api-gateway listening on 3000");
  } catch (error) {
    app.log.error({ err: error }, "failed to start api-gateway");
    await app.close().catch(() => undefined);
    await shutdownTracing().catch(() => undefined);
    process.exit(1);
  }
}

bootstrap().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("api-gateway failed to bootstrap", error);
  await shutdownTracing().catch(() => undefined);
  process.exit(1);
});
