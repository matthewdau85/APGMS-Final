const useMockPrisma = process.env.MOCK_PRISMA_CLIENT === "true";

function createMockPrisma() {
  const mockRiskEvent = {
    async create({ data }: { data: Record<string, unknown> }) {
      return { id: "mock-risk-event", createdAt: new Date(), ...data };
    },
    async findMany() {
      return [] as unknown[];
    },
  };

  return { riskEvent: mockRiskEvent } as unknown as import("@prisma/client").PrismaClient;
}

let prisma: import("@prisma/client").PrismaClient;

if (useMockPrisma) {
  prisma = createMockPrisma();
} else {
  const prismaPkg = await import("@prisma/client");
  const { PrismaClient } = prismaPkg as { PrismaClient: new (...args: any[]) => import("@prisma/client").PrismaClient };

  // Prefer runtime DATABASE_URL. Fail loudly if missing to avoid silent fallbacks.
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Set it in services/api-gateway/.env (or process env).");
  }

  // Force Prisma to use this URL, bypassing any defaults like 'db:5432'
  prisma = new PrismaClient({
    datasources: { db: { url } },
  });
}

export { prisma };

// Re-export a convenience alias if you import { db } elsewhere
export const db = prisma;

