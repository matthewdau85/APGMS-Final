import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = bcrypt.hashSync("admin123", 10);

  await prisma.user.upsert({
    where: { email: "dev@example.com" },
    update: {},
    create: {
      email: "dev@example.com",
      password: hash,
      role: "ADMIN",
    },
  });
}

main()
  .then(() => console.log("Seeded admin user"))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
