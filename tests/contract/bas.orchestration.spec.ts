import assert from "node:assert/strict";
import { test } from "node:test";

import { Prisma } from "@prisma/client";

import { MockBankingProvider } from "../../providers/banking/mock.js";
import type { BankingProviderContext } from "../../providers/banking/types.js";
import { orchestrateBasLodgment } from "../../domain/bas/orchestrator.js";

const randomId = () => `id-${Math.random().toString(16).slice(2, 10)}`;

test("banking providers invoke partner APIs and reconcile designated credits", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push({
    id: "acct-paygw",
    orgId: "org-1",
    type: "PAYGW",
    balance: new Prisma.Decimal(12_000),
    updatedAt: new Date(),
  });

  const provider = new MockBankingProvider();
  const partnerCalls: any[] = [];
  const auditEntries: any[] = [];

  const context: BankingProviderContext = {
    prisma: prisma as any,
    orgId: "org-1",
    actorId: "user-1",
    auditLogger: async (entry) => {
      auditEntries.push(entry);
    },
    partnerBankingApi: {
      async creditDesignatedAccount(request) {
        partnerCalls.push(request);
        return {
          status: "SETTLED",
          partnerReference: `partner-${partnerCalls.length}`,
          settledAmountCents: request.amountCents,
        };
      },
    },
  };

  const result = await provider.creditDesignatedAccount(context, {
    accountId: "acct-paygw",
    amount: 500,
    source: "PAYROLL_CAPTURE",
  });

  assert.equal(result.accountId, "acct-paygw");
  assert.equal(result.newBalance, 12_500);
  assert.equal(partnerCalls.length, 1);
  assert.equal(partnerCalls[0].amountCents, 50_000);
  assert.equal(typeof partnerCalls[0].clientReference, "string");
  assert.equal(partnerCalls[0].clientReference.length > 0, true);
  assert.equal(state.designatedTransfers.length, 1);
  assert.equal(
    auditEntries.some((entry) => entry.action === "designatedAccount.partnerReconcile"),
    true,
  );
});

test("BAS orchestration updates cycle readiness and alerts from designated balances", async () => {
  const { prisma, state } = createInMemoryPrisma();
  const auditEntries: any[] = [];

  state.designatedAccounts.push(
    {
      id: "acct-paygw",
      orgId: "org-1",
      type: "PAYGW",
      balance: new Prisma.Decimal(12_000),
      updatedAt: new Date(),
    },
    {
      id: "acct-gst",
      orgId: "org-1",
      type: "GST",
      balance: new Prisma.Decimal(4_000),
      updatedAt: new Date(),
    },
  );

  state.basCycles.push({
    id: "cycle-1",
    orgId: "org-1",
    periodStart: new Date("2025-10-01T00:00:00Z"),
    periodEnd: new Date("2025-10-31T00:00:00Z"),
    paygwRequired: new Prisma.Decimal(15_000),
    paygwSecured: new Prisma.Decimal(12_000),
    gstRequired: new Prisma.Decimal(4_000),
    gstSecured: new Prisma.Decimal(4_000),
    overallStatus: "BLOCKED",
    lodgedAt: null,
  });

  const summaryBefore = await orchestrateBasLodgment(
    {
      prisma: prisma as any,
      auditLogger: async (entry) => auditEntries.push(entry),
    },
    "org-1",
  );

  assert.equal(summaryBefore.blocked, 1);
  assert.equal(summaryBefore.ready, 0);
  assert.equal(
    state.alerts.some((alert) => alert.type === "PAYGW_SHORTFALL" && alert.resolvedAt === null),
    true,
  );

  const provider = new MockBankingProvider();
  await provider.creditDesignatedAccount(
    {
      prisma: prisma as any,
      orgId: "org-1",
      actorId: "user-1",
      auditLogger: async (entry) => auditEntries.push(entry),
      partnerBankingApi: {
        async creditDesignatedAccount(request) {
          return {
            status: "SETTLED",
            partnerReference: `partner-${request.clientReference}`,
            settledAmountCents: request.amountCents,
          };
        },
      },
    },
    {
      accountId: "acct-paygw",
      amount: 3_000,
      source: "PAYROLL_CAPTURE",
    },
  );

  const summaryAfter = await orchestrateBasLodgment(
    {
      prisma: prisma as any,
      auditLogger: async (entry) => auditEntries.push(entry),
    },
    "org-1",
  );

  const cycle = state.basCycles.find((entry) => entry.id === "cycle-1");
  assert.ok(cycle);
  assert.equal(cycle?.overallStatus, "READY");
  assert.equal(cycle?.paygwSecured.toNumber(), 15_000);
  assert.equal(summaryAfter.ready, 1);
  assert.equal(summaryAfter.blocked, 0);
  assert.equal(
    state.alerts.some((alert) => alert.type === "PAYGW_SHORTFALL" && alert.resolvedAt !== null),
    true,
  );
  assert.equal(
    auditEntries.some((entry) => entry.action === "bas.orchestrated" && entry.metadata.status === "READY"),
    true,
  );
});

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

type BasCycleState = {
  id: string;
  orgId: string;
  periodStart: Date;
  periodEnd: Date;
  paygwRequired: Prisma.Decimal;
  paygwSecured: Prisma.Decimal;
  gstRequired: Prisma.Decimal;
  gstSecured: Prisma.Decimal;
  overallStatus: string;
  lodgedAt: Date | null;
};

type AlertState = {
  id: string;
  orgId: string;
  type: string;
  severity: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNote?: string | null;
};

type AuditEntry = {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
};

type InMemoryState = {
  designatedAccounts: DesignatedAccountState[];
  designatedTransfers: DesignatedTransferState[];
  basCycles: BasCycleState[];
  alerts: AlertState[];
  auditLogs: AuditEntry[];
};

function createInMemoryPrisma(): { prisma: any; state: InMemoryState } {
  const state: InMemoryState = {
    designatedAccounts: [],
    designatedTransfers: [],
    basCycles: [],
    alerts: [],
    auditLogs: [],
  };

  const prisma = {
    $transaction: async (handler: any) => handler(prisma),
    designatedAccount: {
      findUnique: async ({ where }: any) => {
        const match = state.designatedAccounts.find((entry) => entry.id === where.id);
        return match ? { ...match } : null;
      },
      update: async ({ where, data }: any) => {
        const account = state.designatedAccounts.find((entry) => entry.id === where.id);
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
      findMany: async ({ where }: any) => {
        const matches = state.designatedAccounts.filter((entry) => {
          if (where?.orgId && entry.orgId !== where.orgId) return false;
          return true;
        });
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
    },
    alert: {
      findFirst: async ({ where }: any) => {
        const match = state.alerts.find((alert) => {
          if (where?.orgId && alert.orgId !== where.orgId) return false;
          if (where?.type && alert.type !== where.type) return false;
          if (where?.resolvedAt?.equals === null && alert.resolvedAt !== null) return false;
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
          resolutionNote: data.resolutionNote ?? null,
        };
        state.alerts.push(alert);
        return { ...alert };
      },
      update: async ({ where, data }: any) => {
        const alert = state.alerts.find((entry) => entry.id === where.id);
        if (!alert) {
          throw new Error("alert not found");
        }
        if (data.message !== undefined) {
          alert.message = data.message;
        }
        if (data.resolvedAt !== undefined) {
          alert.resolvedAt = data.resolvedAt;
        }
        if (data.resolutionNote !== undefined) {
          alert.resolutionNote = data.resolutionNote;
        }
        return { ...alert };
      },
    },
    basCycle: {
      findMany: async ({ where, orderBy }: any) => {
        const matches = state.basCycles.filter((cycle) => {
          if (where?.orgId && cycle.orgId !== where.orgId) return false;
          if (where?.lodgedAt === null && cycle.lodgedAt !== null) return false;
          return true;
        });
        if (orderBy?.periodStart === "asc") {
          matches.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
        }
        return matches.map((entry) => ({ ...entry }));
      },
      update: async ({ where, data }: any) => {
        const cycle = state.basCycles.find((entry) => entry.id === where.id);
        if (!cycle) {
          throw new Error("cycle not found");
        }
        if (data.paygwSecured) {
          cycle.paygwSecured = data.paygwSecured;
        }
        if (data.gstSecured) {
          cycle.gstSecured = data.gstSecured;
        }
        if (data.overallStatus) {
          cycle.overallStatus = data.overallStatus;
        }
        return { ...cycle };
      },
    },
  };

  return { prisma, state };
}
