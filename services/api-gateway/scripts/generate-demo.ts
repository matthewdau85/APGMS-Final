import { Buffer } from "node:buffer";

import { prisma } from "@apgms/shared/db";

import { configurePIIProviders } from "../src/lib/pii.js";
import { seedDemoOrg } from "../src/lib/demo-seed.js";
import { createKeyManagementService, createSaltProvider } from "../src/security/providers.js";

async function configureCryptoProviders() {
  process.env.PII_KEYS ??= JSON.stringify([{ kid: "demo-seed-key", material: Buffer.alloc(32, 7).toString("base64") }]);
  process.env.PII_ACTIVE_KEY ??= "demo-seed-key";
  process.env.PII_SALTS ??= JSON.stringify([{ sid: "demo-seed-salt", secret: Buffer.alloc(32, 8).toString("base64") }]);
  process.env.PII_ACTIVE_SALT ??= "demo-seed-salt";

  const kms = await createKeyManagementService();
  const saltProvider = await createSaltProvider();
  configurePIIProviders({
    kms,
    saltProvider,
    auditLogger: { record: async () => {} },
  });
}

async function main() {
  await configureCryptoProviders();
  const summary = await seedDemoOrg();
  console.log("Demo seed complete", summary);
}

main()
  .catch((error) => {
    console.error("Demo seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
