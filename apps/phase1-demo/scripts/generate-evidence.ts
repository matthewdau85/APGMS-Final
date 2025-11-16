import { PrismaClient } from "@prisma/client";

import { generateDemoReconciliationArtifact } from "../src/lib/reports.js";
import { ensureBaselineAccounts, loadConfig } from "../src/index.js";

const prisma = new PrismaClient();
const config = loadConfig();

async function main() {
  const accounts = await ensureBaselineAccounts(config.orgId);
  const artifact = await generateDemoReconciliationArtifact(prisma, config.orgId, {
    paygw: accounts.paygwBuffer.id,
    gst: accounts.gstBuffer.id,
    paygi: accounts.paygiBuffer.id,
    clearing: accounts.clearing.id,
  });
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        artifactId: artifact.artifactId,
        sha256: artifact.sha256,
        balances: artifact.summary.balances,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("generate-evidence failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
