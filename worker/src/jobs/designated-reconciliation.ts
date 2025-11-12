import { randomUUID } from "node:crypto";

import { prisma } from "@apgms/shared/db.js";
import type { EventBus } from "@apgms/shared/messaging/event-bus.js";
import {
  DETECTOR_NIGHTLY_SUBJECT,
  mapNightlyToInvalidation,
} from "@apgms/events";

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
  await prisma.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      metadata: entry.metadata,
    },
  });
}

type ReconciliationOptions = {
  eventBus?: EventBus | null;
};

export async function runNightlyDesignatedAccountReconciliation(
  options: ReconciliationOptions = {},
): Promise<void> {
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

    if (options.eventBus) {
      const triggeredAt = new Date();
      const iso = triggeredAt.toISOString();
      const period = iso.slice(0, 10);
      await options.eventBus.publish(DETECTOR_NIGHTLY_SUBJECT, {
        id: randomUUID(),
        orgId: org.id,
        eventType: "detector.nightly",
        key: `detector:${org.id}:${period}`,
        ts: iso,
        schemaVersion: "1",
        source: "worker.designatedReconciliation",
        dedupeId: `detector-nightly:${org.id}:${period}`,
        payload: mapNightlyToInvalidation({
          tenantId: org.id,
          period,
          triggeredAt: iso,
        }),
      });
    }
  }
}

