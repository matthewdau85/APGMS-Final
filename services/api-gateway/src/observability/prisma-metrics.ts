// services/api-gateway/src/observability/prisma-metrics.ts
import type { PrismaClient } from "@prisma/client";
import { metrics } from "./metrics.js";

/**
 * Return a Prisma client extended with query-level timing (Prisma v6+).
 * NOTE: You must use the returned client.
 */
export function instrumentPrisma<T extends PrismaClient>(client: T): T {
  const extended = client.$extends({
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

  return extended as unknown as T;
}
