import { buildServer } from "./app.js";
import { config } from "./config.js";

const port = config.port;
const host = config.host;

async function main() {
  const app = await buildServer();

  const shutdown = async (signal: string) => {
    try {
      app.log.info({ signal }, "shutdown_start");
      await app.close();
      app.log.info("shutdown_complete");
    } catch (error) {
      app.log.error({ err: error }, "shutdown_error");
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port, host });
  app.log.info({ url: `http://${host}:${port}` }, "inference_service_up");
}

main().catch((error) => {
  console.error("inference_startup_failed", error);
  process.exit(1);
});
