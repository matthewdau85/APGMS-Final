import prismaPkg from "@prisma/client";

type PrismaClientInstance = {
  org: Record<string, any>;
  user: Record<string, any>;
  bankLine: Record<string, any>;
  orgTombstone: Record<string, any>;
  adminAuditLog: Record<string, any>;
  $transaction: <T>(fn: (tx: PrismaClientInstance) => Promise<T>) => Promise<T>;
  $queryRaw: (...args: any[]) => Promise<unknown>;
  $disconnect?: () => Promise<void>;
};

const { PrismaClient: PrismaClientCtor } = prismaPkg as unknown as {
  PrismaClient: new (config: { datasources: { db: { url: string } } }) => PrismaClientInstance;
};

// Prefer runtime DATABASE_URL. Fail loudly if missing to avoid silent fallbacks.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Set it in services/api-gateway/.env (or process env).");
}

// Force Prisma to use this URL, bypassing any defaults like 'db:5432'
export const prisma = new PrismaClientCtor({
  datasources: { db: { url } },
});

// Re-export a convenience alias if you import { db } elsewhere
export const db = prisma;
