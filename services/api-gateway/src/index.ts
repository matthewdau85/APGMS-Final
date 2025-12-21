import { buildServer } from "./server";

async function start() {
  const app = buildServer();

  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
    app.log.info(`API Gateway listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
