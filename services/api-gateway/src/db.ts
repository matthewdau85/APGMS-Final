import { PrismaClient } from "@prisma/client";
import { dbQueryDurationSeconds } from "./observability/metrics.js";

export const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const start = process.hrtime.bigint();

        try {
          return await query(args);
        } finally {
          const durationSeconds =
            Number(process.hrtime.bigint() - start) / 1e9;

          dbQueryDurationSeconds
            .labels(model ?? "raw", operation)
            .observe(durationSeconds);
        }
      },
    },
  },
});
