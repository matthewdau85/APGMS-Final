// scripts/db-smoke.cjs
/* eslint-disable no-console */

const { PrismaClient } = require("@prisma/client");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    // Trivial DB touch proof
    const rows = await prisma.$queryRaw`SELECT 1 as ok`;
    console.log("DB_SMOKE_OK", rows);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("DB_SMOKE_FAILED", err);
  process.exit(1);
});
