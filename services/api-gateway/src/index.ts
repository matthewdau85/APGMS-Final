import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { initTelemetry } from "./telemetry";
import { createApp } from "./app";

initTelemetry();

const app = await createApp();

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  app.log.info({ signal }, "shutdown_signal_received");
  try {
    await app.close();
    app.log.info("server_closed");
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, "shutdown_failed");
    process.exit(1);
  }
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});


