import { PrismaClient } from "@prisma/client";
import { dbQueryDurationSeconds } from "./observability/metrics.js";

// Keep it loose so the in-memory client can be swapped in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaClientLike = any;

function createInstrumentedPrisma(): PrismaClientLike {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = process.hrtime.bigint();

          try {
            return await query(args);
          } finally {
            const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;

            dbQueryDurationSeconds.labels(model ?? "raw", operation).observe(durationSeconds);
          }
        },
      },
    },
  });
}

export let prisma: PrismaClientLike = createInstrumentedPrisma();

export function setPrismaClientForTests(client: PrismaClientLike) {
  prisma = client;
}
