import { createHash, randomUUID } from "node:crypto";

import {
  TransactionalTopics,
  TRANSACTIONAL_EVENT_SCHEMA_VERSION,
  type ReconciliationGeneratedEvent,
} from "../../../shared/src/messaging/transactional-events.js";
import { prisma } from "../../../shared/src/db.js";

import {
  persistTransactionalEvent,
  type QualityCheck,
} from "../storage/data-lake.js";

import {
  generateDesignatedAccountReconciliationArtifact,
} from "../../../domain/policy/designated-accounts.js";

const SYSTEM_ACTOR = "system";
const SOURCE = "worker.designated-reconciliation";

function parseRetentionDays(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.floor(parsed);
}

function verifySummaryHash(
  payload: ReconciliationGeneratedEvent,
): void {
  const expected = createHash("sha256")
    .update(JSON.stringify(payload.summary))
    .digest("hex");

  if (expected !== payload.sha256) {
    throw new Error(
      `SHA-256 mismatch for reconciliation artifact ${payload.artifactId}`,
    );
  }
}

function verifySummaryBalances(
  payload: ReconciliationGeneratedEvent,
): void {
  if (payload.summary.totals.paygw < 0 || payload.summary.totals.gst < 0) {
    throw new Error("Aggregate designated balances must be non-negative");
  }

  const invalidMovement = payload.summary.movementsLast24h.find(
    (movement) =>
      movement.balance < 0 ||
      movement.inflow24h < 0 ||
      movement.transferCount24h < 0,
  );

  if (invalidMovement) {
    throw new Error(
      `Designated account ${invalidMovement.accountId} reported negative values`,
    );
  }
}

const reconciliationQualityChecks: QualityCheck<ReconciliationGeneratedEvent>[] = [
  {
    name: "summary_sha256_integrity",
    validate: verifySummaryHash,
  },
  {
    name: "non_negative_balances",
    validate: verifySummaryBalances,
  },
];

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

  const retentionOverride = parseRetentionDays(
    process.env.RECON_EVENT_RETENTION_DAYS,
  );

  for (const org of organisations) {
    const artifact = await generateDesignatedAccountReconciliationArtifact(
      {
        prisma,
        auditLogger: recordAuditLog,
      },
      org.id,
      SYSTEM_ACTOR,
    );

    const event: ReconciliationGeneratedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      schemaVersion: TRANSACTIONAL_EVENT_SCHEMA_VERSION,
      source: SOURCE,
      orgId: org.id,
      artifactId: artifact.artifactId,
      sha256: artifact.sha256,
      summary: artifact.summary,
    };

    await persistTransactionalEvent(
      TransactionalTopics.reconciliation.designatedGenerated,
      event,
      {
        retentionDays: retentionOverride,
        qualityChecks: reconciliationQualityChecks,
      },
    );
  }
}

