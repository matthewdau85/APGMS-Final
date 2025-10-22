import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createApp } from "./app";

const app = await createApp();

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

await app
  .listen({ port, host })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10000);
let isShuttingDown = false;

const handleSignal = async (signal: NodeJS.Signals) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  app.log.info({ signal }, "received shutdown signal");

  const timeout = setTimeout(() => {
    app.log.error({ signal }, "shutdown timed out");
    process.exit(1);
  }, shutdownTimeoutMs);

  try {
    await app.close();
    if (typeof app.prisma?.$disconnect === "function") {
      await app.prisma.$disconnect();
    }
    clearTimeout(timeout);
    app.log.info("shutdown complete");
    process.exit(0);
  } catch (err) {
    clearTimeout(timeout);
    app.log.error({ err }, "error during shutdown");
    process.exit(1);
  }
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void handleSignal(signal);
  });
}

