import { PrismaClient } from "@prisma/client";
import { seedAu } from "./seeds/au/index.js";

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedAu(prisma);
    console.log("\n🌱  The seed command has been executed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
