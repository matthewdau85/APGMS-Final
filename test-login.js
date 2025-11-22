const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs"); // we installed this

const prisma = new PrismaClient();

async function main() {
  const email = "dev@example.com";
  const plain = "admin123";

  const user = await prisma.user.findUnique({ where: { email } });

  console.log("User row:", user);

  if (!user) {
    console.log("No user found with that email.");
    return;
  }

  const ok = await bcrypt.compare(plain, user.password);
  console.log("Does admin123 match stored hash?", ok);
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
