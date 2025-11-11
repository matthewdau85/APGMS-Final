import { createHash } from "node:crypto";

import { prisma } from "@apgms/shared/db.js";

import {
  generateDesignatedAccountReconciliationArtifact,
} from "../../../domain/policy/designated-accounts.js";

const SYSTEM_ACTOR = "system";

async function recordAuditLog(entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const previous = await prisma.auditLog.findFirst({
    where: { orgId: entry.orgId },
    orderBy: { createdAt: "desc" },
  });

  const createdAt = new Date();
  const prevHash = previous?.hash ?? null;
  const payload = JSON.stringify({
    orgId: entry.orgId,
    actorId: entry.actorId,
    action: entry.action,
    metadata: entry.metadata,
    createdAt: createdAt.toISOString(),
    prevHash,
  });

  const hash = createHash("sha256").update(payload).digest("hex");

  const created = await prisma.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      metadata: entry.metadata,
      createdAt,
      hash,
      prevHash,
    },
  });

  await prisma.auditLogSeal.create({
    data: {
      auditLogId: created.id,
      sha256: hash,
      sealedBy: entry.actorId,
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
  }
}

