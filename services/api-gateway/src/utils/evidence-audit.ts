// services/api-gateway/src/utils/evidence-audit.ts
import { prisma } from "../db.js";

export type EvidenceAuditRecord = {
  orgId: string;
  artifactId: string;
  requesterId: string;
  timestamp?: Date;
  throwOnError?: boolean;
};

export async function recordEvidenceAudit({
  orgId,
  artifactId,
  requesterId,
  timestamp,
  throwOnError = false,
}: EvidenceAuditRecord): Promise<void> {
  try {
    await prisma.evidenceAudit.create({
      data: {
        orgId,
        artifactId,
        requesterId,
        createdAt: timestamp ?? new Date(),
      },
    });
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    // eslint-disable-next-line no-console
    console.warn("evidence-audit failure", {
      error,
      orgId,
      artifactId,
      requesterId,
    });
  }
}
