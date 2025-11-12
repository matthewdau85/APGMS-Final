import { prisma } from "@apgms/shared/db.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function main() {
  const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  const artifact = await prisma.evidenceArtifact.findFirst({
    where: {
      kind: "designated-reconciliation",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!artifact) {
    throw new Error("No designated-reconciliation artefact generated within the last 24 hours");
  }

  console.info("designated-reconciliation artifact found", {
    artifactId: artifact.id,
    sha256: artifact.sha256,
    createdAt: artifact.createdAt,
  });
}

main()
  .catch((error) => {
    console.error("designated-reconciliation health check failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
