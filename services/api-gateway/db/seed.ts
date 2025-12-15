import { PrismaClient } from "@prisma/client";
import { seedAu } from "./seeds/au/index.js";

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedAu(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
