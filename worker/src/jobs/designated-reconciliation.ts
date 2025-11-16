import {
  safeLogAttributes,
  safeLogError,
} from "@apgms/shared";
import { prisma } from "@apgms/shared/db.js";
import {
  generateDesignatedAccountReconciliationArtifact,
} from "@apgms/domain-policy";
import {
  applyPendingContributions,
  summarizeContributions,
} from "@apgms/shared/ledger/ingest.js";
import {
  DesignatedAccountType,
  ensureDesignatedAccountCoverage,
} from "@apgms/shared/ledger/designated-account.js";

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
  const failureDetails: Array<{ orgId: string; error: string }> = [];

  console.info(
    "designated-account-reconciliation: starting",
    safeLogAttributes({ orgCount: organisations.length }),
  );

  for (const org of organisations) {
    const orgStart = Date.now();
    try {
      await applyPendingContributions({
        prisma,
        orgId: org.id,
        actorId: SYSTEM_ACTOR,
        auditLogger: recordAuditLog,
      });

      const totals = await summarizeContributions(prisma, org.id);
      const latestCycle = await prisma.basCycle.findFirst({
        where: { orgId: org.id },
        orderBy: { periodStart: "desc" },
      });

      if (latestCycle) {
        await ensureDesignatedAccountCoverage(
          prisma,
          org.id,
          "PAYGW_BUFFER",
          Number(latestCycle.paygwRequired),
        );
        await ensureDesignatedAccountCoverage(
          prisma,
          org.id,
          "GST_BUFFER",
          Number(latestCycle.gstRequired),
        );
      }

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
          contributions: totals,
        }),
      );
    } catch (error) {
      failures += 1;
      console.error(
        "designated-account-reconciliation: org failed",
        safeLogError(error),
        safeLogAttributes({ orgId: org.id }),
      );
      failureDetails.push({
        orgId: org.id,
        error:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : (() => {
                try {
                  return JSON.stringify(error);
                } catch {
                  return "unknown_error";
                }
              })(),
      });
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
      failureDetails,
      durationMs: Date.now() - runStart,
    }),
  );
}
