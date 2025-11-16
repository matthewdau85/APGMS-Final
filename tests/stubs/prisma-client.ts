export class PrismaClient {
  constructor() {
    throw new Error("Prisma client is unavailable in the current test environment");
  }
}

export const Prisma = {} as Record<string, unknown>;
