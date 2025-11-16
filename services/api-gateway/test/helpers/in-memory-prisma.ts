import { Decimal } from "@prisma/client/runtime/library.js";

export type DesignatedAccountState = {
  id: string;
  orgId: string;
  type: string;
  balance: Decimal;
  updatedAt: Date;
};

export type DesignatedTransferState = {
  id: string;
  orgId: string;
  accountId: string;
  amount: Decimal;
  source: string;
  createdAt: Date;
};

export type AlertState = {
  id: string;
  orgId: string;
  type: string;
  severity: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type EvidenceArtifactState = {
  id: string;
  orgId: string;
  kind: string;
  sha256: string;
  wormUri: string;
  payload: unknown;
  createdAt: Date;
};

export type AuditEntry = {
  id: string;
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type InMemoryState = {
  designatedAccounts: DesignatedAccountState[];
  designatedTransfers: DesignatedTransferState[];
  alerts: AlertState[];
  evidenceArtifacts: EvidenceArtifactState[];
  auditLogs: AuditEntry[];
};

const randomId = () => `id-${Math.random().toString(16).slice(2, 10)}`;

export function createInMemoryPrisma(): { prisma: any; state: InMemoryState } {
  const state: InMemoryState = {
    designatedAccounts: [],
    designatedTransfers: [],
    alerts: [],
    evidenceArtifacts: [],
    auditLogs: [],
  };

  const prisma = {
    alert: {
      findFirst: async ({ where }: any) => {
        const match = state.alerts.find((alert) => {
          if (alert.orgId !== where.orgId) return false;
          if (where.type && alert.type !== where.type) return false;
          if (where.severity && alert.severity !== where.severity) return false;
          if (where.resolvedAt?.equals === null && alert.resolvedAt !== null) {
            return false;
          }
          return true;
        });
        return match ? { ...match } : null;
      },
      create: async ({ data }: any) => {
        const alert: AlertState = {
          id: data.id ?? randomId(),
          orgId: data.orgId,
          type: data.type,
          severity: data.severity,
          message: data.message,
          createdAt: data.createdAt ?? new Date(),
          resolvedAt: data.resolvedAt ?? null,
        };
        state.alerts.push(alert);
        return { ...alert };
      },
    },
    designatedAccount: {
      findUnique: async ({ where }: any) => {
        const account = state.designatedAccounts.find(
          (entry) => entry.id === where.id,
        );
        return account ? { ...account } : null;
      },
      update: async ({ where, data }: any) => {
        const account = state.designatedAccounts.find(
          (entry) => entry.id === where.id,
        );
        if (!account) {
          throw new Error("account not found");
        }
        if (data.balance) {
          account.balance = data.balance;
        }
        if (data.updatedAt) {
          account.updatedAt = data.updatedAt;
        }
        if (data.locked !== undefined) {
          (account as any).locked = data.locked;
        }
        if (data.lockedAt !== undefined) {
          (account as any).lockedAt = data.lockedAt;
        }
        return { ...account };
      },
      findFirst: async ({ where }: any) => {
        const account = state.designatedAccounts.find((entry) => {
          if (entry.orgId !== where.where?.orgId) return false;
          if (where.where?.type && entry.type !== where.where.type) return false;
          return true;
        });
        return account ? { ...account } : null;
      },
      findMany: async ({ where, include }: any) => {
        const accounts = state.designatedAccounts.filter(
          (entry) => entry.orgId === where.orgId,
        );
        if (!include?.transfers) {
          return accounts.map((entry) => ({ ...entry }));
        }
        return accounts.map((entry) => {
          const transfers = state.designatedTransfers.filter(
            (transfer) => transfer.accountId === entry.id,
          );
          return {
            ...entry,
            transfers: transfers
              .filter((transfer) => {
                const gte = include.transfers.where?.createdAt?.gte;
                if (gte && transfer.createdAt < gte) return false;
                return true;
              })
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
          };
        });
      },
    },
    evidenceArtifact: {
      create: async ({ data }: any) => {
        const artifact: EvidenceArtifactState = {
          id: data.id ?? randomId(),
          orgId: data.orgId,
          kind: data.kind,
          sha256: data.sha256,
          wormUri: data.wormUri,
          payload: data.payload,
          createdAt: data.createdAt ?? new Date(),
        };
        state.evidenceArtifacts.push(artifact);
        return { ...artifact };
      },
      update: async ({ where, data }: any) => {
        const artifact = state.evidenceArtifacts.find(
          (entry) => entry.id === where.id,
        );
        if (!artifact) {
          throw new Error("artifact not found");
        }
        if (data.wormUri) {
          artifact.wormUri = data.wormUri;
        }
        return { ...artifact };
      },
      findMany: async ({ where }: any) => {
        const matches = state.evidenceArtifacts.filter(
          (entry) => entry.orgId === where.orgId,
        );
        return matches.map((entry) => ({ ...entry }));
      },
    },
    designatedTransfer: {
      create: async ({ data }: any) => {
        const transfer: DesignatedTransferState = {
          id: data.id ?? randomId(),
          orgId: data.orgId,
          accountId: data.accountId,
          amount: data.amount,
          source: data.source,
          createdAt: data.createdAt ?? new Date(),
        };
        state.designatedTransfers.push(transfer);
        return { ...transfer };
      },
      findMany: async ({ where, orderBy, take }: any) => {
        const matches = state.designatedTransfers
          .filter((entry) => entry.orgId === where.orgId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (orderBy?.createdAt === "desc") {
          matches.reverse();
        }
        if (take) {
          return matches.slice(0, take).map((entry) => ({ ...entry }));
        }
        return matches.map((entry) => ({ ...entry }));
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        const entry: AuditEntry = {
          id: data.id ?? randomId(),
          orgId: data.orgId,
          actorId: data.actorId,
          action: data.action,
          metadata: data.metadata ?? {},
          createdAt: data.createdAt ?? new Date(),
        };
        state.auditLogs.push(entry);
        return { ...entry };
      },
    },
    $transaction: async (callback: (tx: any) => Promise<any>) =>
      callback(prisma),
  };

  return { prisma, state };
}
