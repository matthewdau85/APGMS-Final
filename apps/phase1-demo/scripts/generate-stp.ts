import { PrismaClient } from "@prisma/client";

import { generateDemoStpReport } from "../src/lib/reports.js";
import { ensureBaselineAccounts, loadConfig } from "../src/index.js";

const prisma = new PrismaClient();
const config = loadConfig();

async function main() {
  const accounts = await ensureBaselineAccounts(config.orgId);
  const filePath = await generateDemoStpReport(
    prisma,
    config.orgId,
    accounts.paygwBuffer.id,
    process.argv[2],
  );
  // eslint-disable-next-line no-console
  console.log(`STP file written to ${filePath}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("generate-stp failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
