import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { Prisma } from "@prisma/client";

import {
  applyDesignatedAccountTransfer,
  generateDesignatedAccountReconciliationArtifact,
} from "../../../domain/policy/designated-accounts.js";
import { createBankingProvider } from "../../../providers/banking/index.js";

type DesignatedAccountState = {
  id: string;
  orgId: string;
  type: string;
  balance: Prisma.Decimal;
  updatedAt: Date;
};

type DesignatedTransferState = {
  id: string;
  orgId: string;
  accountId: string;
  amount: Prisma.Decimal;
  source: string;
  createdAt: Date;
};

type AlertState = {
  id: string;
  orgId: string;
  type: string;
  severity: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

type EvidenceArtifactState = {
  id: string;
  orgId: string;
  kind: string;
  sha256: string;
  wormUri: string;
  payload: unknown;
  createdAt: Date;
};

type AuditEntry = {
  id: string;
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  hash: string;
  prevHash: string | null;
};

type DesignatedStateTransition = {
  id: string;
  orgId: string;
  accountId: string;
  fromState: string | null;
  toState: string;
  actorId: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};

type DesignatedViolationFlagState = {
  id: string;
  orgId: string;
  accountId: string | null;
  code: string;
  severity: string;
  status: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  metadata: Record<string, unknown>;
};

type ReconciliationSnapshotState = {
  id: string;
  orgId: string;
  sha256: string;
  actorId: string;
  generatedAt: Date;
  paygwBalance: number;
  gstBalance: number;
};

type AuditLogSealState = {
  id: string;
  auditLogId: string;
  sha256: string;
  sealedAt: Date;
  sealedBy: string;
};

type InMemoryState = {
  designatedAccounts: DesignatedAccountState[];
  designatedTransfers: DesignatedTransferState[];
  alerts: AlertState[];
  evidenceArtifacts: EvidenceArtifactState[];
  auditLogs: AuditEntry[];
  designatedAccountStates: DesignatedStateTransition[];
  designatedViolationFlags: DesignatedViolationFlagState[];
  reconciliationSnapshots: ReconciliationSnapshotState[];
  auditLogSeals: AuditLogSealState[];
};

const randomId = () => `id-${Math.random().toString(16).slice(2, 10)}`;

function createInMemoryPrisma(): { prisma: any; state: InMemoryState } {
  const state: InMemoryState = {
    designatedAccounts: [],
    designatedTransfers: [],
    alerts: [],
    evidenceArtifacts: [],
    auditLogs: [],
    designatedAccountStates: [],
    designatedViolationFlags: [],
    reconciliationSnapshots: [],
    auditLogSeals: [],
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
        account.updatedAt = data.updatedAt ?? new Date();
        return { ...account };
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
    designatedAccountStateTransition: {
      findFirst: async ({ where, orderBy }: any) => {
        const matches = state.designatedAccountStates.filter((entry) => {
          if (where?.accountId && entry.accountId !== where.accountId) return false;
          if (where?.orgId && entry.orgId !== where.orgId) return false;
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        const found = matches[0];
        return found ? { ...found } : null;
      },
      create: async ({ data }: any) => {
        const transition: DesignatedStateTransition = {
          id: data.id ?? randomId(),
          orgId: data.orgId,
          accountId: data.accountId,
          fromState: data.fromState ?? null,
          toState: data.toState,
          actorId: data.actorId,
          reason: data.reason ?? null,
          metadata: data.metadata ?? null,
          createdAt: data.createdAt ?? new Date(),
        };
        state.designatedAccountStates.push(transition);
        return { ...transition };
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
      findMany: async ({ where }: any) => {
        return state.designatedTransfers
          .filter((entry) => entry.orgId === where.orgId)
          .map((entry) => ({ ...entry }));
      },
    },
    designatedViolationFlag: {
      findFirst: async ({ where }: any) => {
        const match = state.designatedViolationFlags.find((entry) => {
          if (entry.orgId !== where.orgId) return false;
          if (where.accountId && entry.accountId !== where.accountId) return false;
          if (where.code && entry.code !== where.code) return false;
          if (where.status && entry.status !== where.status) return false;
          return true;
        });
        return match ? { ...match } : null;
      },
      create: async ({ data }: any) => {
        const flag: DesignatedViolationFlagState = {
          id: data.id ?? randomId(),
          orgId: data.orgId,
          accountId: data.accountId ?? null,
          code: data.code,
          severity: data.severity,
          status: data.status ?? "OPEN",
          detectedAt: data.detectedAt ?? new Date(),
          resolvedAt: data.resolvedAt ?? null,
          metadata: (data.metadata as Record<string, unknown>) ?? {},
        };
        state.designatedViolationFlags.push(flag);
        return { ...flag };
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
        return state.evidenceArtifacts
          .filter((entry) => entry.orgId === where.orgId)
          .map((entry) => ({ ...entry }));
      },
    },
    designatedReconciliationSnapshot: {
      create: async ({ data }: any) => {
        const snapshot: ReconciliationSnapshotState = {
          id: data.id ?? randomId(),
          orgId: data.orgId,
          sha256: data.sha256,
          actorId: data.actorId,
          generatedAt: data.generatedAt ?? new Date(),
          paygwBalance: Number(data.paygwBalance ?? 0),
          gstBalance: Number(data.gstBalance ?? 0),
        };
        state.reconciliationSnapshots.push(snapshot);
        return { ...snapshot };
      },
    },
    auditLog: {
      findFirst: async ({ where }: any) => {
        const match = state.auditLogs
          .filter((entry) => entry.orgId === where.orgId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        return match ? { ...match } : null;
      },
      create: async ({ data }: any) => {
        const previous = state.auditLogs
          .filter((entry) => entry.orgId === data.orgId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

        const createdAt = data.createdAt ?? new Date();
        const prevHash = data.prevHash ?? previous?.hash ?? null;
        const metadata = (data.metadata as Record<string, unknown>) ?? {};
        const payload = JSON.stringify({
          orgId: data.orgId,
          actorId: data.actorId,
          action: data.action,
          metadata,
          createdAt: createdAt.toISOString(),
          prevHash,
        });
        const hash =
          data.hash ?? createHash("sha256").update(payload).digest("hex");

        const entry: AuditEntry = {
          id: data.id ?? randomId(),
          orgId: data.orgId,
          actorId: data.actorId,
          action: data.action,
          metadata,
          createdAt,
          hash,
          prevHash,
        };
        state.auditLogs.push(entry);
        return { ...entry };
      },
    },
    auditLogSeal: {
      create: async ({ data }: any) => {
        const seal: AuditLogSealState = {
          id: data.id ?? randomId(),
          auditLogId: data.auditLogId,
          sha256: data.sha256,
          sealedAt: data.sealedAt ?? new Date(),
          sealedBy: data.sealedBy,
        };
        state.auditLogSeals.push(seal);
        return { ...seal };
      },
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => callback(prisma),
  };

  return { prisma, state };
}

test("designated accounts block debit attempts and raise alerts", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push({
    id: "acct-paygw",
    orgId: "org-1",
    type: "PAYGW",
    balance: new Prisma.Decimal(12000),
    updatedAt: new Date(),
  });

  const provider = createBankingProvider("mock");

  const context = {
    prisma,
    orgId: "org-1",
    actorId: "system",
    auditLogger: async (entry: any) => {
      await prisma.auditLog.create({ data: entry });
    },
  };

  await assert.rejects(
    () =>
      provider.simulateDebitAttempt(context, {
        accountId: "acct-paygw",
        amount: 500,
        source: "PAYROLL_CAPTURE",
      }),
    (error: any) => Boolean(error && error.code === "designated_withdrawal_attempt"),
  );
  assert.equal(state.alerts.length, 1);
  assert.equal(state.alerts[0].type, "DESIGNATED_WITHDRAWAL_ATTEMPT");
  assert.equal(state.auditLogs.some((entry) => entry.action === "designatedAccount.violation"), true);
});

test("designated account reconciliation emits evidence artefact", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push(
    {
      id: "acct-paygw",
      orgId: "org-1",
      type: "PAYGW",
      balance: new Prisma.Decimal(0),
      updatedAt: new Date(),
    },
    {
      id: "acct-gst",
      orgId: "org-1",
      type: "GST",
      balance: new Prisma.Decimal(0),
      updatedAt: new Date(),
    },
  );

  await applyDesignatedAccountTransfer(
    {
      prisma,
      auditLogger: async (entry: any) => {
        await prisma.auditLog.create({ data: entry });
      },
    },
    {
      orgId: "org-1",
      accountId: "acct-paygw",
      amount: 1500,
      source: "PAYROLL_CAPTURE",
      actorId: "system",
    },
  );

  await applyDesignatedAccountTransfer(
    {
      prisma,
      auditLogger: async (entry: any) => {
        await prisma.auditLog.create({ data: entry });
      },
    },
    {
      orgId: "org-1",
      accountId: "acct-gst",
      amount: 800,
      source: "GST_CAPTURE",
      actorId: "system",
    },
  );

  const { summary, artifactId, sha256, snapshotId } =
    await generateDesignatedAccountReconciliationArtifact(
      {
        prisma,
        auditLogger: async (entry: any) => {
          await prisma.auditLog.create({ data: entry });
        },
      },
      "org-1",
      "system",
    );

  assert.ok(artifactId.length > 0);
  assert.ok(sha256.length === 64);
  assert.ok(snapshotId.length > 0);
  assert.equal(summary.totals.paygw, 1500);
  assert.equal(summary.totals.gst, 800);
  assert.equal(state.evidenceArtifacts.length, 1);
  assert.equal(state.reconciliationSnapshots.length, 1);
  assert.equal(state.reconciliationSnapshots[0]?.id, snapshotId);
  assert.equal(
    state.evidenceArtifacts[0].kind,
    "designated-reconciliation",
  );
  assert.equal(
    state.auditLogs.some(
      (entry) => entry.action === "designatedAccount.reconciliation",
    ),
    true,
  );
});
