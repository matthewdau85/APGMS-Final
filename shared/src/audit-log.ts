import { createHash } from "node:crypto";

export type AuditLogEvent = "data_export" | "data_delete";

export interface AppendOnlyAuditLogEntry {
  event: AuditLogEvent;
  orgId: string;
  principalId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface AppendOnlyAuditLog {
  append(entry: AppendOnlyAuditLogEntry): Promise<void>;
}

type PrismaAuditClient = {
  adminAuditLog: {
    findFirst: (args: {
      where: { orgId: string };
      orderBy: { createdAt: "asc" | "desc" };
      select: { hash: true };
    }) => Promise<{ hash: string } | null>;
    create: (args: {
      data: {
        orgId: string;
        principalId: string;
        event: string;
        payload: Record<string, unknown>;
        occurredAt: Date;
        hash: string;
        prevHash: string | null;
      };
    }) => Promise<unknown>;
  };
  $transaction: <T>(fn: (tx: PrismaAuditClient) => Promise<T>) => Promise<T>;
};

export function createAppendOnlyAuditLog(prisma: PrismaAuditClient): AppendOnlyAuditLog {
  return {
    async append(entry) {
      const canonicalEntry = canonicaliseEntry(entry);
      await prisma.$transaction(async (tx) => {
        const previous = await tx.adminAuditLog.findFirst({
          where: { orgId: canonicalEntry.orgId },
          orderBy: { createdAt: "desc" },
          select: { hash: true },
        });
        const prevHash = previous?.hash ?? null;
        const hash = computeAuditHash(prevHash, canonicalEntry);
        await tx.adminAuditLog.create({
          data: {
            orgId: canonicalEntry.orgId,
            principalId: canonicalEntry.principalId,
            event: canonicalEntry.event,
            payload: canonicalEntry.payload,
            occurredAt: canonicalEntry.occurredAt,
            hash,
            prevHash,
          },
        });
      });
    },
  } satisfies AppendOnlyAuditLog;
}

export function computeAuditHash(
  prevHash: string | null,
  entry: CanonicalAuditEntry
): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ prevHash, entry }));
  return hash.digest("hex");
}

interface CanonicalAuditEntry extends AppendOnlyAuditLogEntry {}

function canonicaliseEntry(entry: AppendOnlyAuditLogEntry): CanonicalAuditEntry {
  return {
    ...entry,
    occurredAt: new Date(entry.occurredAt),
    payload: entry.payload,
  };
}
