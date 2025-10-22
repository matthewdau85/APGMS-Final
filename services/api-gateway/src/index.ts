import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createApp } from "./app";
import { setupSignalHandlers } from "./shutdown";

const app = await createApp();

setupSignalHandlers(app);

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app
  .listen({ port, host })
  .catch((err) => {
    app.log.error(err);
    void app.close().catch((closeErr) => {
      app.log.error({ err: closeErr }, "failed to close app after listen error");
    });
    process.exit(1);
  });

