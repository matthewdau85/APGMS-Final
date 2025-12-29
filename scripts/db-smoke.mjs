import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

// Deterministic ID so repeated CI runs don't create unbounded junk.
// Use upsert so reruns are safe.
const SMOKE_ORG_ID = "00000000-0000-4000-8000-0000000000db";
const SMOKE_ORG_NAME = "CI Smoke Org";

async function main() {
  // 1) Connect + trivial query (proves network + creds)
  await prisma.$connect();
  const ping = await prisma.$queryRaw`SELECT 1 AS ok`;
  if (!Array.isArray(ping)) {
    throw new Error("DB smoke failed: expected queryRaw array result");
  }

  // 2) Write + read + cleanup (proves schema + migrations)
  // NOTE: Uses model `Organization` (present in your Prisma schema).
  const org = await prisma.organization.upsert({
    where: { id: SMOKE_ORG_ID },
    create: { id: SMOKE_ORG_ID, name: SMOKE_ORG_NAME },
    update: { name: SMOKE_ORG_NAME },
    select: { id: true, name: true },
  });

  if (org.id !== SMOKE_ORG_ID || org.name !== SMOKE_ORG_NAME) {
    throw new Error(`DB smoke failed: unexpected org row ${JSON.stringify(org)}`);
  }

  const fetched = await prisma.organization.findUnique({
    where: { id: SMOKE_ORG_ID },
    select: { id: true, name: true },
  });

  if (!fetched) {
    throw new Error("DB smoke failed: org not found after upsert");
  }

  // Cleanup: delete the smoke org. If your schema adds FK constraints later,
  // adjust cleanup order explicitly (no silent ignores).
  await prisma.organization.delete({ where: { id: SMOKE_ORG_ID } });

  // Confirm deletion
  const after = await prisma.organization.findUnique({ where: { id: SMOKE_ORG_ID } });
  if (after !== null) {
    throw new Error("DB smoke failed: cleanup did not remove org");
  }

  console.log("✅ DB smoke passed (connect + query + write/read + cleanup)");
}

main()
  .catch((err) => {
    console.error("❌ DB smoke failed");
    console.error(err?.stack ?? String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
