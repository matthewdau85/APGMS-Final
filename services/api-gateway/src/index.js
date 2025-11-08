import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { buildServer } from "./app.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
const app = await buildServer();
let shuttingDown = false;
const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";
app
    .listen({ port, host })
    .then(() => {
    app.log.info({ port, host }, "api-gateway listening");
})
    .catch((err) => {
    app.log.error({ err }, "failed to start api-gateway");
    process.exit(1);
});
async function shutdown(signal) {
    if (shuttingDown)
        return;
    shuttingDown = true;
    app.log.info({ signal }, "received shutdown signal");
    try {
        await app.close();
        app.log.info("api-gateway shut down cleanly");
        process.exit(0);
    }
    catch (error) {
        app.log.error({ error }, "error during shutdown");
        process.exit(1);
    }
}
const signals = ["SIGINT", "SIGTERM"];
for (const signal of signals) {
    process.on(signal, () => {
        void shutdown(signal);
    });
}
process.on("unhandledRejection", (reason) => {
    app.log.error({ reason }, "unhandled rejection");
});
process.on("uncaughtException", (error) => {
    app.log.error({ error }, "uncaught exception");
    void shutdown("uncaughtException");
});
