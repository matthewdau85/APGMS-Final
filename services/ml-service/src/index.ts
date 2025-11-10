import process from "node:process";

import { createServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "9100", 10);
const host = process.env.HOST ?? "0.0.0.0";

const app = await createServer();

try {
  await app.listen({ port, host });
  app.log.info({ port, host }, "ml-service listening");
} catch (error) {
  app.log.error({ error }, "ml-service startup failure");
  process.exit(1);
}

const signals: Array<NodeJS.Signals> = ["SIGINT", "SIGTERM"];

for (const signal of signals) {
  process.once(signal, async () => {
    app.log.info({ signal }, "ml-service shutdown initiated");
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "ml-service shutdown error");
      process.exit(1);
    }
  });
}
