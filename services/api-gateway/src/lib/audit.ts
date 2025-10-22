import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface AuditEvent {
  actorId: string;
  action: string;
  orgId?: string;
  subjectId?: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
}

type PrismaAudit = Pick<PrismaClient, "auditLog">;

type AuditLogRecordInput = {
  actorId: string;
  action: string;
  orgId: string | null;
  subjectId: string | null;
  payload: Record<string, unknown>;
  timestamp: Date;
};

export function createAuditLogger(prisma: PrismaAudit): AuditLogger {
  return {
    async record(event: AuditEvent): Promise<void> {
      const timestamp = normalizeTimestamp(event.timestamp);
      const base: AuditLogRecordInput = {
        actorId: event.actorId,
        action: event.action,
        orgId: event.orgId ?? null,
        subjectId: event.subjectId ?? null,
        payload: event.payload ?? {},
        timestamp,
      };

      const previous = await prisma.auditLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { hash: true },
      });

      const prevHash = previous?.hash ?? null;
      const digest = createHash("sha256")
        .update(JSON.stringify({ ...base, prevHash }))
        .digest("hex");

      await prisma.auditLog.create({
        data: {
          ...base,
          prevHash,
          hash: digest,
        },
      });
    },
  };
}

function normalizeTimestamp(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid audit timestamp");
  }
  return date;
}
