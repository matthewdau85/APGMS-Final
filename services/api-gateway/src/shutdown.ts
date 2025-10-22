import type { FastifyInstance } from "fastify";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface ShutdownOptions {
  timeoutMs?: number;
}

export function setupSignalHandlers(
  app: FastifyInstance,
  options: ShutdownOptions = {}
): () => void {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  const handlers = new Map<NodeJS.Signals, () => void>();

  for (const signal of signals) {
    const handler = async () => {
      app.log.info({ signal }, "received shutdown signal");
      const timeout = setTimeout(() => {
        app.log.error({ signal }, "shutdown timed out");
        process.exit(1);
      }, timeoutMs);
      if (typeof timeout.unref === "function") {
        timeout.unref();
      }

      try {
        await app.close();
        clearTimeout(timeout);
        process.exit(0);
      } catch (err) {
        clearTimeout(timeout);
        app.log.error({ signal, err }, "failed to shutdown cleanly");
        process.exit(1);
      }
    };

    process.once(signal, handler);
    handlers.set(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      process.removeListener(signal, handler);
    }
  };
}
