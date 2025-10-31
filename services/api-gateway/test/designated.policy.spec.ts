import assert from "node:assert/strict";
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
};

type InMemoryState = {
  designatedAccounts: DesignatedAccountState[];
  designatedTransfers: DesignatedTransferState[];
  alerts: AlertState[];
  evidenceArtifacts: EvidenceArtifactState[];
  auditLogs: AuditEntry[];
};

const randomId = () => `id-${Math.random().toString(16).slice(2, 10)}`;

function createInMemoryPrisma(): { prisma: any; state: InMemoryState } {
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

  const { summary, artifactId, sha256 } =
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
  assert.equal(summary.totals.paygw, 1500);
  assert.equal(summary.totals.gst, 800);
  assert.equal(state.evidenceArtifacts.length, 1);
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
