import { createApp } from "./app.js";
import { maskError } from "./lib/masking.js";

const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = await createApp();

  // helpful watchdog log so we know if Fastify.listen callback never fires
  const bootWatchdog = setTimeout(() => {
    app.log.warn(
      { port: PORT, host: HOST },
      "server_still_starting_after_10s"
    );
  }, 10_000);

  // IMPORTANT: use callback form instead of await'ing the Promise.
  app.listen(
    { port: PORT, host: HOST },
    (err: unknown, address: string | undefined) => {
      clearTimeout(bootWatchdog);

      if (err) {
        app.log.error({ err }, "listen_failed");
        // eslint-disable-next-line no-console
        console.error("fatal_boot_error", err);
        process.exit(1);
        return;
      }

      app.log.info(
        { address, port: PORT, host: HOST },
        "api-gateway_listening"
      );
    }
  );

  //
  // graceful shutdown / drain
  //
  const shutdown = async () => {
    app.log.info("draining_start");
    try {
      await app.close();
      app.log.info("draining_complete");
      process.exit(0);
    } catch (err: unknown) {
      app.log.error({ err }, "draining_failed");
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// top-level boot with last-resort fatal logging
main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("fatal_boot_error", maskError(err));
  process.exit(1);
});
