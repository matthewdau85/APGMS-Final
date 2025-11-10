import { buildServer } from "./app.js";
import { startTracing, stopTracing } from "./observability/tracing.js";

const PORT = Number(process.env.PORT ?? "3000");
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  await startTracing();

  const app = await buildServer();
  await app.listen({ port: PORT, host: HOST });

  const shutdown = async () => {
    try {
      await app.close();
    } finally {
      await stopTracing();
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal boot error:", err);
  process.exit(1);
});
