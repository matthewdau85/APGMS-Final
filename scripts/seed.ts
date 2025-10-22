import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@apgms/shared/db";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "password123";
  const hashedPassword = hashPassword(adminPassword);

  const org = await prisma.org.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: "Demo Org" },
  });

  await prisma.user.upsert({
    where: { email: "founder@example.com" },
    update: {},
    create: { email: "founder@example.com", password: hashedPassword, orgId: org.id },
  });

  const today = new Date();
  await prisma.bankLine.createMany({
    data: [
      { orgId: org.id, date: new Date(today.getFullYear(), today.getMonth(), today.getDate()-2), amount: 1250.75, payee: "Acme", desc: "Office fit-out" },
      { orgId: org.id, date: new Date(today.getFullYear(), today.getMonth(), today.getDate()-1), amount: -299.99, payee: "CloudCo", desc: "Monthly sub" },
      { orgId: org.id, date: today, amount: 5000.00, payee: "Birchal", desc: "Investment received" },
    ],
    skipDuplicates: true,
  });

  console.log("Seed OK");
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
