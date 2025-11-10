import assert from "node:assert/strict";
import { test } from "node:test";

import { Prisma } from "@prisma/client";

import {
  creditDesignatedAccountForObligation,
  type CreditDesignatedAccountInput,
} from "../../domain/policy/designated-accounts.js";

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

type InMemoryState = {
  accounts: DesignatedAccountState[];
  transfers: DesignatedTransferState[];
  alerts: Array<{ orgId: string; type: string }>;
  auditLogs: Array<{ action: string; metadata: Record<string, unknown> }>;
};

function createInMemoryPrisma() {
  const state: InMemoryState = {
    accounts: [],
    transfers: [],
    alerts: [],
    auditLogs: [],
  };

  const prisma = {
    designatedAccount: {
      findFirst: async ({ where }: any) => {
        const match = state.accounts.find(
          (account) => account.orgId === where.orgId && account.type === where.type,
        );
        return match ? { ...match } : null;
      },
      findUnique: async ({ where }: any) => {
        const match = state.accounts.find((account) => account.id === where.id);
        return match ? { ...match } : null;
      },
      update: async ({ where, data }: any) => {
        const account = state.accounts.find((entry) => entry.id === where.id);
        if (!account) throw new Error("account not found");
        if (data.balance) account.balance = data.balance;
        if (data.updatedAt) account.updatedAt = data.updatedAt;
        return { ...account };
      },
    },
    designatedTransfer: {
      create: async ({ data }: any) => {
        const transfer: DesignatedTransferState = {
          id: data.id ?? `xfer-${state.transfers.length + 1}`,
          orgId: data.orgId,
          accountId: data.accountId,
          amount: data.amount,
          source: data.source,
          createdAt: data.createdAt ?? new Date(),
        };
        state.transfers.push(transfer);
        return { ...transfer };
      },
    },
    alert: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        state.alerts.push({ orgId: data.orgId, type: data.type });
        return { ...data, id: data.id ?? `alert-${state.alerts.length}` };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        state.auditLogs.push({ action: data.action, metadata: data.metadata ?? {} });
        return { ...data, id: data.id ?? `audit-${state.auditLogs.length}` };
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(prisma),
  };

  return { prisma, state };
}

test("credits PAYGW and GST obligations into designated accounts", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.accounts.push(
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

  const context = {
    prisma: prisma as any,
    auditLogger: async (entry: any) => {
      await prisma.auditLog.create({ data: entry });
    },
  };

  const paygwInput: CreditDesignatedAccountInput = {
    orgId: "org-1",
    accountType: "PAYGW",
    amount: 640,
    source: "PAYROLL_CAPTURE",
    actorId: "adapter",
  };

  const gstInput: CreditDesignatedAccountInput = {
    orgId: "org-1",
    accountType: "GST",
    amount: 10,
    source: "GST_CAPTURE",
    actorId: "adapter",
  };

  const paygwResult = await creditDesignatedAccountForObligation(context, paygwInput);
  const gstResult = await creditDesignatedAccountForObligation(context, gstInput);

  assert.equal(paygwResult.newBalance, 640);
  assert.equal(gstResult.newBalance, 10);
  assert.equal(state.transfers.length, 2);
  assert.equal(state.transfers[0].source, "PAYROLL_CAPTURE");
  assert.equal(state.transfers[1].source, "GST_CAPTURE");
  assert.equal(state.auditLogs.filter((entry) => entry.action === "designatedAccount.credit").length, 2);
});

test("throws when designated account for obligation is missing", async () => {
  const { prisma } = createInMemoryPrisma();
  const context = { prisma: prisma as any };

  await assert.rejects(
    () =>
      creditDesignatedAccountForObligation(context, {
        orgId: "org-2",
        accountType: "GST",
        amount: 100,
        source: "GST_CAPTURE",
        actorId: "tester",
      }),
    (error: any) => error?.code === "designated_account_not_found",
  );
});
