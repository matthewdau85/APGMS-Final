// services/api-gateway/src/db.ts
import pkg from "@prisma/client";
import { instrumentPrisma } from "./observability/prisma-metrics.js";

// Prisma v6 ships its client on the default export. TypeScript's view of the
// default export doesn't declare PrismaClient as a value, so we cast.
const { PrismaClient } = pkg as unknown as {
  PrismaClient: new (...args: any[]) => any;
};

const prismaClient = new PrismaClient();

export const prisma = instrumentPrisma(prismaClient);

