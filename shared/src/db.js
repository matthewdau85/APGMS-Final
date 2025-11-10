import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg;
// Prefer runtime DATABASE_URL. Fail loudly if missing to avoid silent fallbacks.
const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error("DATABASE_URL is not set. Set it in services/api-gateway/.env (or process env).");
}
// Force Prisma to use this URL, bypassing any defaults like 'db:5432'
export const prisma = new PrismaClient({
    datasources: { db: { url } },
});
// Re-export a convenience alias if you import { db } elsewhere
export const db = prisma;
//# sourceMappingURL=db.js.map