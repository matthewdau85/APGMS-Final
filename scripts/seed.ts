import argon2 from "argon2";
import { prisma } from "@apgms/shared/db";

async function main() {
  const org = await prisma.org.upsert({
    where: { id: "demo" },
    update: {},
    create: { id: "demo", name: "Demo Org" },
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD env var must be set");
  }

  const hash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: "admin@apgms.local" },
    update: { passwordHash: hash, roles: ["admin"], orgId: org.id },
    create: {
      email: "admin@apgms.local",
      passwordHash: hash,
      roles: ["admin"],
      orgId: org.id,
    },
  });

  const today = new Date();
  await prisma.bankLine.createMany({
    data: [
      {
        orgId: org.id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
        amount: 1250.75,
        payee: "Acme",
        desc: "Office fit-out",
      },
      {
        orgId: org.id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
        amount: -299.99,
        payee: "CloudCo",
        desc: "Monthly sub",
      },
      {
        orgId: org.id,
        date: today,
        amount: 5000.0,
        payee: "Birchal",
        desc: "Investment received",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed OK");
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
