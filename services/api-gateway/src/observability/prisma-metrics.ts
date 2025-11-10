import type { PrismaClient } from "@prisma/client";

import { metrics } from "./metrics.js";

const attached = new WeakMap<PrismaClient, PrismaClient>();

export function attachPrismaMetrics<T extends PrismaClient>(client: T): T {
  const existing = attached.get(client);
  if (existing) {
    return existing as T;
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
  }) as T;

  attached.set(client, instrumented as PrismaClient);
  attached.set(instrumented as PrismaClient, instrumented as PrismaClient);

  return instrumented;
}
