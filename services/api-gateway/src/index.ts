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

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error({ err }, "failed to start api-gateway");
  process.exit(1);
}

const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT ?? 10000);
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
let shuttingDown = false;

for (const signal of signals) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  const startedAt = Date.now();
  app.log.info({ signal }, "received shutdown signal");

  let exitCode = 0;
  const timeout = setTimeout(() => {
    const duration = Date.now() - startedAt;
    app.log.error({ duration }, "shutdown timed out");
    exitCode = 1;
    process.exit(exitCode);
  }, shutdownTimeoutMs);
  timeout.unref();

  try {
    await app.close();
  } catch (err) {
    exitCode = 1;
    app.log.error({ err }, "failed to close app cleanly");
  }

  clearTimeout(timeout);
  const duration = Date.now() - startedAt;
  const log = exitCode === 0 ? app.log.info.bind(app.log) : app.log.error.bind(app.log);
  log({ duration }, "shutdown complete");
  process.exit(exitCode);
}

