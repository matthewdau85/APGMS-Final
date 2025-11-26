// services/api-gateway/src/observability/prisma-metrics.ts
import { metrics } from "./metrics.js";

/**
 * Return a Prisma-like client extended with query-level timing (Prisma v6+).
 * This is defensive: if $extends is missing, we just return the original client.
 */
export function instrumentPrisma<T>(client: T): T {
  const anyClient = client as any;

  if (typeof anyClient.$extends !== "function") {
    return client;
  }

  const extended = anyClient.$extends({
    query: {
      $allModels: {
        async $allOperations(ctx: any) {
          const model = ctx.model ?? "UnknownModel";
          const operation = ctx.operation ?? "unknown";
          const end = metrics.dbQueryDuration.startTimer({ model, operation });
          try {
            return await ctx.query(ctx.args as any);
          } finally {
            end();
          }
        },
      },
    },
  });

  return extended as T;
}

