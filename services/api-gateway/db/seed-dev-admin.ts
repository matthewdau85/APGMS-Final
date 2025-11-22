// db/seed-dev-admin.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "dev@example.com";
  const password = "admin123";

  // Hash password using bcrypt (adjust rounds if you like)
  const passwordHash = await bcrypt.hash(password, 10);

  // ⚠️ IMPORTANT:
  // Change field names below to match your `User` model in schema.prisma
  // Common pattern:
  // model User {
  //   id           String  @id @default(cuid())
  //   email        String  @unique
  //   passwordHash String
  //   role         String
  //   ...
  // }

  const user = await prisma.user.upsert({
    where: { email },          // <-- email field name
    update: {
      passwordHash,           // <-- password field name
      role: "ADMIN",          // <-- adjust to whatever your enum/string is
    },
    create: {
      email,                  // <-- email field name
      passwordHash,           // <-- password field name
      role: "ADMIN",          // <-- adjust
    },
  });

  console.log("Seeded dev admin user:", {
    id: user.id,
    email: user.email,
    role: (user as any).role,
  });
}

main()
  .catch((err) => {
    console.error("Failed to seed dev admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
