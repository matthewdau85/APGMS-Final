import {
  safeLogAttributes,
  safeLogError,
} from "@apgms/shared";
import { prisma } from "@apgms/shared/db.js";

import {
  generateDesignatedAccountReconciliationArtifact,
} from "@apgms/domain-policy";

const SYSTEM_ACTOR = "system";

async function recordAuditLog(entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      metadata: entry.metadata,
    },
  });
}

export async function runNightlyDesignatedAccountReconciliation(): Promise<void> {
  const organisations = await prisma.org.findMany({
    select: { id: true },
  });
  const runStart = Date.now();
  let processed = 0;
  let successes = 0;
  let failures = 0;

  console.info(
    "designated-account-reconciliation: starting",
    safeLogAttributes({ orgCount: organisations.length }),
  );

  for (const org of organisations) {
    const orgStart = Date.now();
    try {
      const { artifactId, sha256, summary } =
        await generateDesignatedAccountReconciliationArtifact(
          {
            prisma,
            auditLogger: recordAuditLog,
          },
          org.id,
          SYSTEM_ACTOR,
        );
      const durationMs = Date.now() - orgStart;

      successes += 1;
      console.info(
        "designated-account-reconciliation: artifact generated",
        safeLogAttributes({
          orgId: org.id,
          artifactId,
          sha256,
          totals: summary.totals,
          durationMs,
        }),
      );
    } catch (error) {
      failures += 1;
      console.error(
        "designated-account-reconciliation: org failed",
        safeLogError(error),
        safeLogAttributes({ orgId: org.id }),
      );
      throw error;
    } finally {
      processed += 1;
    }
  }

  console.info(
    "designated-account-reconciliation: run summary",
    safeLogAttributes({
      orgCount: organisations.length,
      processed,
      successes,
      failures,
      durationMs: Date.now() - runStart,
    }),
  );
}
