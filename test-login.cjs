const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

// Paste your real DATABASE_URL from shared/prisma/prisma/.env:
const DATABASE_URL = "postgresql://apgms:apgms@localhost:5432/apgms?schema=public"; // <-- replace this

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

async function main() {
  const email = "dev@example.com";
  const plain = "admin123";

  console.log("Using DATABASE_URL:", DATABASE_URL);

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
  .catch(err => console.error("Error in test-login:", err))
  .finally(async () => {
    await prisma.$disconnect();
  });
