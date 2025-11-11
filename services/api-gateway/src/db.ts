let prismaInstance: any;

try {
  const { PrismaClient } = await import("@prisma/client");
  prismaInstance = new PrismaClient();
} catch (error) {
  const unavailable = async () => {
    throw new Error("prisma_client_unavailable");
  };

  const createDelegate = () => ({
    findMany: unavailable,
    findUnique: unavailable,
    findFirst: unavailable,
    upsert: unavailable,
    count: unavailable,
    delete: unavailable,
    update: unavailable,
    create: unavailable,
  });

  prismaInstance = {
    bankLine: createDelegate(),
    user: createDelegate(),
    $queryRaw: unavailable,
    $executeRaw: unavailable,
  };
  if (process.env.NODE_ENV !== "production") {
    console.warn("Prisma client not available; using no-op stub.");
  }
}

export const prisma = prismaInstance;
