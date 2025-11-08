import { prisma } from "@apgms/shared/db.js";

import {
  generateDesignatedAccountReconciliationArtifact,
} from "../../../domain/policy/designated-accounts.js";
import { createAnalyticsEventLogger } from "../../../domain/ledger/analytics-events.js";

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

  const analyticsLogger = createAnalyticsEventLogger(prisma, {
    domain: "policy",
    source: "worker.designated-reconciliation",
  });

  for (const org of organisations) {
    await generateDesignatedAccountReconciliationArtifact(
      {
        prisma,
        auditLogger: recordAuditLog,
        analyticsLogger,
      },
      org.id,
      SYSTEM_ACTOR,
    );
  }
}

