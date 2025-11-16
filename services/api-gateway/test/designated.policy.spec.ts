import assert from "node:assert/strict";
import { test } from "node:test";

import { Decimal } from "@prisma/client/runtime/library.js";

import { AppError } from "@apgms/shared";
import {
  applyDesignatedAccountTransfer,
  generateDesignatedAccountReconciliationArtifact,
} from "@apgms/domain-policy";
import { createBankingProvider } from "../../../providers/banking/index.js";
import { createInMemoryPrisma } from "./helpers/in-memory-prisma.js";

test("mock banking provider credit exercises the shared policy surface", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push({
    id: "acct-paygw",
    orgId: "org-1",
    type: "PAYGW",
    balance: new Decimal(0),
    updatedAt: new Date(),
  });

  const provider = createBankingProvider("mock");

  assert.equal(provider.capabilities.maxWriteCents, 1_000_000);
  assert.equal(provider.capabilities.maxReadTransactions, 200);

  const context = {
    prisma,
    orgId: "org-1",
    actorId: "system",
    auditLogger: async (entry: any) => {
      await prisma.auditLog.create({ data: entry });
    },
  };

  const result = await provider.creditDesignatedAccount(context, {
    accountId: "acct-paygw",
    amount: 1200,
    source: "PAYROLL_CAPTURE",
  });

  assert.equal(result.accountId, "acct-paygw");
  assert.equal(result.newBalance, 1200);
  assert.equal(result.source, "PAYROLL_CAPTURE");
  assert.equal(state.designatedTransfers.length, 1);
  assert.equal(state.alerts.length, 0);
});

test("banking provider enforces per-adapter write cap", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push({
    id: "acct-paygw",
    orgId: "org-1",
    type: "PAYGW",
    balance: new Decimal(0),
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
      provider.creditDesignatedAccount(context, {
        accountId: "acct-paygw",
        amount: provider.capabilities.maxWriteCents + 1,
        source: "PAYROLL_CAPTURE",
      }),
    (error: unknown) => error instanceof AppError && error.code === "banking_write_cap_exceeded",
  );

  assert.equal(state.designatedTransfers.length, 0);
});

test("createBankingProvider defaults to mock for unknown adapters", () => {
  const provider = createBankingProvider("new-provider");
  assert.equal(provider.id, "mock");
});

test("designated accounts block debit attempts and raise alerts", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push({
    id: "acct-paygw",
    orgId: "org-1",
    type: "PAYGW",
    balance: new Decimal(12000),
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

test("deposit-only violations keep the documented message", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push({
    id: "acct-paygw",
    orgId: "org-1",
    type: "PAYGW",
    balance: new Decimal(500),
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
        amount: 250,
        source: "PAYROLL_CAPTURE",
      }),
    (error: unknown) =>
      error instanceof AppError && error.code === "designated_withdrawal_attempt",
  );

  assert.equal(state.alerts[0].message, "Designated accounts are deposit-only; debits are prohibited");
  assert.equal(state.alerts[0].severity, "HIGH");
});

test("untrusted sources raise alerts with metadata", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push({
    id: "acct-paygw",
    orgId: "org-1",
    type: "PAYGW",
    balance: new Decimal(100),
    updatedAt: new Date(),
  });

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
      applyDesignatedAccountTransfer(
        {
          prisma: context.prisma,
          auditLogger: context.auditLogger,
        },
        {
          orgId: context.orgId,
          accountId: "acct-paygw",
          amount: 500,
          source: "SKETCHY_SOURCE",
          actorId: context.actorId,
        },
      ),
    (error: unknown) =>
      error instanceof AppError && error.code === "designated_untrusted_source",
  );

  assert.equal(
    state.alerts[0].message,
    "Designated account funding source 'SKETCHY_SOURCE' is not whitelisted",
  );
  assert.equal(state.auditLogs[0].metadata.violation, "designated_untrusted_source");
});

test("designated account reconciliation emits evidence artefact", async () => {
  const { prisma, state } = createInMemoryPrisma();

  state.designatedAccounts.push(
    {
      id: "acct-paygw",
      orgId: "org-1",
      type: "PAYGW",
      balance: new Decimal(0),
      updatedAt: new Date(),
    },
    {
      id: "acct-gst",
      orgId: "org-1",
      type: "GST",
      balance: new Decimal(0),
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
