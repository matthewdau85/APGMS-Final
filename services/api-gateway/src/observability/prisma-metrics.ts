import type { PrismaClient } from "@prisma/client";

import { metrics } from "./metrics.js";

const attached = new WeakSet<PrismaClient>();

export function attachPrismaMetrics(client: PrismaClient): void {
  if (attached.has(client)) {
    return;
  }

  type QueryContext = {
    model?: string;
    operation?: string;
    args: unknown;
    query: (args: unknown) => Promise<unknown>;
    [key: string]: unknown;
  };

  const instrumented = client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: QueryContext) {
          const modelLabel = model ?? "raw";
          const operationLabel = operation ?? "unknown";

          const stop = metrics.dbQueryDuration.startTimer({
            model: modelLabel,
            operation: operationLabel,
          });

          try {
            const result = await query(args);
            metrics.dbQueryTotal
              .labels(modelLabel, operationLabel, "success")
              .inc();
            stop();
            return result;
          } catch (error) {
            metrics.dbQueryTotal
              .labels(modelLabel, operationLabel, "error")
              .inc();
            stop();
            throw error;
          }
        },
      },
    },
  });

  Object.assign(client, instrumented);
  attached.add(client);
}
