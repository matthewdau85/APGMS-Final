import { prisma } from "@apgms/shared/db.js";

import {
  generateDesignatedAccountReconciliationArtifact,
} from "../../../domain/policy/designated-accounts.js";
import { orchestrateBasLodgment } from "../../../domain/bas/orchestrator.js";

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

  for (const org of organisations) {
    await generateDesignatedAccountReconciliationArtifact(
      {
        prisma,
        auditLogger: recordAuditLog,
      },
      org.id,
      SYSTEM_ACTOR,
    );

    await orchestrateBasLodgment(
      {
        prisma,
        auditLogger: recordAuditLog,
      },
      org.id,
    );
  }
}

