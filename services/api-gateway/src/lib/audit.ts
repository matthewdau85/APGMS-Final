// services/api-gateway/src/lib/audit.ts
import crypto from "node:crypto";
import { prisma } from "../db.js";

type RecordAuditLogParams = {
  orgId: string;
  actorId: string;
  action: string;
  // We only need this to be JSON-serialisable; avoid hard Prisma typing.
  metadata?: unknown | null;
  throwOnError?: boolean;
  timestamp?: Date;
};

export async function recordAuditLog({
  orgId,
  actorId,
  action,
  metadata,
  throwOnError = false,
  timestamp,
}: RecordAuditLogParams): Promise<void> {
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

    await prisma.auditLog.create({
      data: {
        orgId,
        actorId,
        action,
        // Let Prisma coerce this to JSON; avoid JsonNull typings.
        metadata: metadataValue as any,
        createdAt,
        hash,
        prevHash,
      },
    });
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    // eslint-disable-next-line no-console
    console.warn("audit-log failure", { error, orgId, action });
  }
}

export async function recordCriticalAuditLog(
  params: Omit<RecordAuditLogParams, "throwOnError">
) {
  await recordAuditLog({ ...params, throwOnError: true });
}
