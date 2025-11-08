import type { PrismaClient } from "@prisma/client";

import { metrics } from "./metrics.js";

const instrumentedClients = new WeakMap<object, unknown>();

export function attachPrismaMetrics<T extends PrismaClient>(client: T): T {
  const existing = instrumentedClients.get(client);
  if (existing) {
    return existing as T;
  }

  const instrumented = client.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          const normalizedModel = model ?? "raw";
          const normalizedOperation = operation ?? "unknown";
          const stop = metrics.dbQueryDuration.startTimer({
            model: normalizedModel,
            operation: normalizedOperation,
          });

          try {
            const result = await query(args);
            metrics.dbQueryTotal
              .labels(normalizedModel, normalizedOperation, "success")
              .inc();
            return result;
          } catch (error) {
            metrics.dbQueryTotal
              .labels(normalizedModel, normalizedOperation, "error")
              .inc();
            throw error;
          } finally {
            stop();
          }
        },
      },
    },
  });

  instrumentedClients.set(client, instrumented);
  return instrumented as T;
}
