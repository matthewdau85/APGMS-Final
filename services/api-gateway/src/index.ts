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

const handleSignal = (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "received shutdown signal");
  void (async () => {
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "error during shutdown");
      process.exit(1);
    }
  })();
};

process.once("SIGINT", handleSignal);
process.once("SIGTERM", handleSignal);

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});


