import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createApp } from "./app";

const app = await createApp();

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

const prisma = (app as typeof app & { prisma?: { $disconnect?: () => Promise<void> } }).prisma;

const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10000);
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    app.log.warn({ signal }, "shutdown already in progress");
    return;
  }
  shuttingDown = true;

  app.log.info({ signal }, "received shutdown signal");

  let exitCode = 0;
  const timeout = setTimeout(() => {
    app.log.error({ signal }, "shutdown timed out");
    process.exit(1);
  }, shutdownTimeoutMs);
  timeout.unref();

  try {
    await app.close();
    app.log.info({ signal }, "fastify server closed");
  } catch (error) {
    exitCode = 1;
    app.log.error({ signal, err: error }, "failed to close fastify");
  }

  if (prisma && typeof prisma.$disconnect === "function") {
    try {
      await prisma.$disconnect();
      app.log.info({ signal }, "prisma disconnected");
    } catch (error) {
      exitCode = 1;
      app.log.error({ signal, err: error }, "failed to disconnect prisma");
    }
  }

  clearTimeout(timeout);
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

