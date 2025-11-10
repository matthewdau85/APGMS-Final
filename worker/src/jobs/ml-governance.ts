import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { prisma } from "@apgms/shared/db.js";

import {
  generateFairnessReport,
  generateExplainabilityReport,
} from "../../../domain/ml/reports.js";

const SYSTEM_ACTOR = "ml-governance";

async function recordAuditLog(orgId: string, action: string, metadata: Record<string, unknown>) {
  const previous = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  const createdAt = new Date();
  const payload = JSON.stringify({ orgId, actorId: SYSTEM_ACTOR, action, metadata, createdAt });
  const prevHash = previous?.hash ?? null;
  const hash = createHash("sha256").update(payload + (prevHash ?? "")).digest("hex");

  await prisma.auditLog.create({
    data: {
      orgId,
      actorId: SYSTEM_ACTOR,
      action,
      metadata,
      createdAt,
      hash,
      prevHash,
    },
  });
}

export async function runMlGovernanceSweep(): Promise<void> {
  const organisations = await prisma.org.findMany({ select: { id: true } });
  const artifactDir = join(process.cwd(), "artifacts", "ml");
  mkdirSync(artifactDir, { recursive: true });

  for (const org of organisations) {
    const fairness = await generateFairnessReport(prisma, org.id);
    const explainability = await generateExplainabilityReport(prisma, org.id);

    const fairnessPayload = {
      report: fairness,
      access: { classification: "restricted", roles: ["ml-admin"] },
    };
    const fairnessContent = JSON.stringify(fairnessPayload, null, 2);
    const fairnessHash = createHash("sha256").update(fairnessContent).digest("hex");
    const fairnessFile = join(
      artifactDir,
      `fairness-${org.id}-${fairness.generatedAt.replace(/[:.]/g, "-")}.json`,
    );
    writeFileSync(fairnessFile, fairnessContent, "utf8");

    const fairnessArtifact = await prisma.evidenceArtifact.create({
      data: {
        orgId: org.id,
        kind: "ML_FAIRNESS_REPORT",
        wormUri: `file://${fairnessFile}`,
        sha256: fairnessHash,
        payload: fairnessPayload,
      },
    });

    await recordAuditLog(org.id, "ml.fairness.generated", {
      artifactId: fairnessArtifact.id,
      hash: fairnessHash,
    });

    const explainabilityPayload = {
      report: explainability,
      access: { classification: "restricted", roles: ["ml-admin", "auditor"] },
    };
    const explainabilityContent = JSON.stringify(explainabilityPayload, null, 2);
    const explainabilityHash = createHash("sha256").update(explainabilityContent).digest("hex");
    const explainabilityFile = join(
      artifactDir,
      `explainability-${org.id}-${explainability.generatedAt.replace(/[:.]/g, "-")}.json`,
    );
    writeFileSync(explainabilityFile, explainabilityContent, "utf8");

    const explainabilityArtifact = await prisma.evidenceArtifact.create({
      data: {
        orgId: org.id,
        kind: "ML_EXPLAINABILITY_REPORT",
        wormUri: `file://${explainabilityFile}`,
        sha256: explainabilityHash,
        payload: explainabilityPayload,
      },
    });

    await recordAuditLog(org.id, "ml.explainability.generated", {
      artifactId: explainabilityArtifact.id,
      hash: explainabilityHash,
    });

    await prisma.forensicLog.create({
      data: {
        orgId: org.id,
        category: "ml_governance",
        message: "Automated ML fairness & explainability reports generated",
        payload: {
          fairnessArtifactId: fairnessArtifact.id,
          explainabilityArtifactId: explainabilityArtifact.id,
        },
      },
    });
  }
}

export default runMlGovernanceSweep;
