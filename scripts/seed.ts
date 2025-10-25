import { Buffer } from "node:buffer";

import { prisma } from "@apgms/shared/db";
import { hashPassword } from "@apgms/shared";
import { encryptPII, configurePIIProviders } from "../services/api-gateway/src/lib/pii";
import { createKeyManagementService, createSaltProvider } from "../services/api-gateway/src/security/providers";

async function main() {
  process.env.PII_KEYS ??= JSON.stringify([{ kid: "seed-key", material: Buffer.alloc(32, 5).toString("base64") }]);
  process.env.PII_ACTIVE_KEY ??= "seed-key";
  process.env.PII_SALTS ??= JSON.stringify([{ sid: "seed-salt", secret: Buffer.alloc(32, 6).toString("base64") }]);
  process.env.PII_ACTIVE_SALT ??= "seed-salt";

  const kms = await createKeyManagementService();
  const saltProvider = await createSaltProvider();
  configurePIIProviders({
    kms,
    saltProvider,
    auditLogger: {
      record: async () => {
        // Seeding audit logs is unnecessary; no-op.
      },
    },
  });

  const org = await prisma.org.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: "Demo Org" },
  });

  const hashedPassword = await hashPassword("password123");

  await prisma.user.upsert({
    where: { email: "founder@example.com" },
    update: {},
    create: { email: "founder@example.com", password: hashedPassword, orgId: org.id },
  });

  const today = new Date();
  const lines = [
    { date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2), amount: 1250.75, payee: "Acme", desc: "Office fit-out" },
    { date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), amount: -299.99, payee: "CloudCo", desc: "Monthly sub" },
    { date: today, amount: 5000.0, payee: "Birchal", desc: "Investment received" },
  ].map((entry) => {
    const payee = encryptPII(entry.payee);
    const desc = encryptPII(entry.desc);
    return {
      orgId: org.id,
      date: entry.date,
      amount: entry.amount,
      payeeCiphertext: payee.ciphertext,
      payeeKid: payee.kid,
      descCiphertext: desc.ciphertext,
      descKid: desc.kid,
    };
  });

  await prisma.bankLine.createMany({
    data: lines,
    skipDuplicates: true,
  });

  console.log("Seed OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
