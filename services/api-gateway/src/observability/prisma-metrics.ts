import type { PrismaClient } from "@prisma/client";

import { metrics } from "./metrics.js";

const attached = new WeakSet<object>();

export function attachPrismaMetrics(client: PrismaClient): void {
  if (attached.has(client)) {
    return;
  }

  client.$use(async (params, next) => {
    const model = params.model ?? "raw";
    const operation = params.action ?? params.type ?? "unknown";

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
  });

  attached.add(client);
}
