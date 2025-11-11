import { buildServer } from "./server.js";
import { config } from "./config.js";

async function main() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: config.host });
  app.log.info({ port: config.port, host: config.host }, "ml_service_started");

  const shutdown = async (signal: string) => {
    try {
      app.log.info({ signal }, "ml_service_shutdown");
      await app.close();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("ml_service_startup_failure", error);
  process.exit(1);
});
