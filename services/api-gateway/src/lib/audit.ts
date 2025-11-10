import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

type RecordAuditLogParams = {
  orgId: string;
  actorId: string;
  action: string;
  metadata?: Prisma.JsonValue | null;
  throwOnError?: boolean;
  timestamp?: Date;
};

export type AuditLogRecord = {
  id: string;
  hash: string;
  createdAt: Date;
};

export async function recordAuditLog({
  orgId,
  actorId,
  action,
  metadata,
  throwOnError = false,
  timestamp,
}: RecordAuditLogParams): Promise<AuditLogRecord | null> {
  try {
    const previous = await prisma.auditLog.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });

    const createdAt = timestamp ?? new Date();
    const metadataValue = metadata ?? null;
    const prevHash = previous?.hash ?? null;

    const hashPayload = JSON.stringify({
      orgId,
      actorId,
      action,
      metadata: metadataValue,
      createdAt: createdAt.toISOString(),
      prevHash,
    });

    const hash = crypto.createHash("sha256").update(hashPayload).digest("hex");

    const created = await prisma.auditLog.create({
      data: {
        orgId,
        actorId,
        action,
        metadata: metadataValue ?? Prisma.JsonNull,
        createdAt,
        hash,
        prevHash,
      },
    });
    return { id: created.id, hash: created.hash, createdAt };
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    // eslint-disable-next-line no-console
    console.warn("audit-log failure", { error, orgId, action });
    return null;
  }
}
