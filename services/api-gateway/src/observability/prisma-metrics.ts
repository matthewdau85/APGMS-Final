import type { PrismaClient } from "@prisma/client";

type PrismaMiddleware = (
  params: Record<string, unknown>,
  next: (params: Record<string, unknown>) => Promise<unknown>,
) => Promise<unknown>;

import { metrics } from "./metrics.js";

const attached = new WeakSet<object>();

export function attachPrismaMetrics(client: PrismaClient): void {
  if (attached.has(client)) {
    return;
  }

  const middleware: PrismaMiddleware = async (params, next) => {
    const model = (params.model as string | undefined) ?? "raw";
    const operation =
      (params.action as string | undefined) ??
      (params.type as string | undefined) ??
      "unknown";

    const stop = metrics.dbQueryDuration.startTimer({
      model,
      operation,
    });

    try {
      const result = await next(params);
      metrics.dbQueryTotal
        .labels(model, operation, "success")
        .inc();
      stop();
      return result;
    } catch (error) {
      metrics.dbQueryTotal
        .labels(model, operation, "error")
        .inc();
      stop();
      throw error;
    }
  };

  (client as PrismaClient & { $use?: (middleware: PrismaMiddleware) => void }).$use?.(
    middleware,
  );

  attached.add(client);
}
