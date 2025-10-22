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

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

async function shutdown(signal: NodeJS.Signals) {
  app.log.info({ signal }, "received shutdown signal");

  const timeout = setTimeout(() => {
    app.log.error({ signal }, "shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);
  timeout.unref();

  try {
    await app.close();
    const prisma = app.prisma as { $disconnect?: () => Promise<void> };
    if (prisma && typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, "failed during shutdown");
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

