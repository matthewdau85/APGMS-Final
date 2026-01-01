import { buildServer } from "./server.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 3000);

let app: ReturnType<typeof buildServer> | null = null;

async function start() {
  app = buildServer();

  await app.listen({ host: HOST, port: PORT });
  app.log.info(`API Gateway listening on ${HOST}:${PORT}`);
}

async function shutdown(signal: string) {
  if (!app) process.exit(0);

  try {
    app.log.info({ signal }, "Shutting down...");
    await app.close();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
