import { instrumentPrisma } from "./observability/prisma-metrics.js";

const useMockPrisma = process.env.MOCK_PRISMA_CLIENT === "true";

function createMockPrisma() {
  return {
    user: {
      async findUnique() {
        return {
          id: "mock-user",
          orgId: "mock-org",
          role: "admin",
          mfaEnabled: true,
          password: "mock-password-hash",
        };
      },
    },
    $extends() {
      return this;
    },
  } as unknown as import("@prisma/client").PrismaClient;
}

let prismaClient: import("@prisma/client").PrismaClient;

if (useMockPrisma) {
  prismaClient = createMockPrisma();
} else {
  const { PrismaClient } = await import("@prisma/client");
  prismaClient = new PrismaClient();
}

export const prisma = instrumentPrisma(prismaClient);
