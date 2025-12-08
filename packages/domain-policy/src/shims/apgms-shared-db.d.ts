// packages/domain-policy/src/shims/apgms-shared-db.d.ts

declare module "@apgms/shared/db.js" {
  import type { PrismaClient } from "@prisma/client";

  // Match the runtime export shape from shared/src/db.ts
  export const prisma: PrismaClient;
}
