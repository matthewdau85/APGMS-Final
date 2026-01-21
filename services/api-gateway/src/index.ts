// services/api-gateway/src/index.ts
import { buildServer } from "./server.js";

async function main() {
  const app = buildServer();

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
  const host = String(process.env.HOST ?? "0.0.0.0");

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error({ err }, "Failed to start server");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    try {
      app.log.info({ signal }, "Shutting down");
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err, signal }, "Shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
