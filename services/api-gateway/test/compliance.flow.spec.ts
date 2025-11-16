import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { Decimal } from "@prisma/client/runtime/library";

import {
  recordPayrollContribution,
  recordPosTransaction,
  applyPendingContributions,
  summarizeContributions,
} from "@apgms/shared/ledger/ingest.js";
import { ensureDesignatedAccountCoverage } from "@apgms/shared/ledger/designated-account.js";
import { applyDesignatedAccountTransfer } from "@apgms/domain-policy";

const fixturePath = path.join(
  process.cwd(),
  "artifacts",
  "compliance",
  "fixtures",
  "pilot-workload.json",
);

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

describe("compliance pilot workloads", () => {
  it("replays payroll/POS ingestion and unblocks transfers after remediation", async () => {
    const { prisma, state } = createCompliancePrisma(fixture);

    await assert.rejects(
      ensureDesignatedAccountCoverage(
        prisma as any,
        fixture.orgId,
        "PAYGW_BUFFER",
        fixture.basCycle.paygwRequired,
      ),
      /designated_insufficient_funds/,
    );

    assert.equal(state.alerts.length > 0, true);

    for (const payroll of fixture.payroll) {
      await recordPayrollContribution({
        prisma: prisma as any,
        orgId: fixture.orgId,
        amount: payroll.amount,
        actorId: payroll.actorId,
        payload: payroll.payload,
        idempotencyKey: payroll.id,
      });
    }

    for (const pos of fixture.pos) {
      await recordPosTransaction({
        prisma: prisma as any,
        orgId: fixture.orgId,
        amount: pos.amount,
        actorId: pos.actorId,
        payload: pos.payload,
        idempotencyKey: pos.id,
      });
    }

    await applyPendingContributions({ prisma: prisma as any, orgId: fixture.orgId, actorId: "ops" });

    const paygwAccount = await ensureDesignatedAccountCoverage(
      prisma as any,
      fixture.orgId,
      "PAYGW_BUFFER",
      fixture.basCycle.paygwRequired,
    );
    const gstAccount = await ensureDesignatedAccountCoverage(
      prisma as any,
      fixture.orgId,
      "GST_BUFFER",
      fixture.basCycle.gstRequired,
    );

    const openAlert = state.alerts.find((alert) => !alert.resolvedAt);
    if (openAlert) {
      await prisma.alert.update({
        where: { id: openAlert.id },
        data: { resolvedAt: new Date() },
      });
    }

    const summary = await summarizeContributions(prisma as any, fixture.orgId);
    assert.ok(summary.paygwSecured >= fixture.basCycle.paygwRequired);
    assert.ok(summary.gstSecured >= fixture.basCycle.gstRequired);

    const transfer = await applyDesignatedAccountTransfer(
      { prisma: prisma as any },
      {
        orgId: fixture.orgId,
        accountId: paygwAccount.id,
        amount: 500,
        source: "bas_transfer",
        actorId: "ops",
      },
    );

    assert.ok(transfer.transferId);
    assert.equal(state.designatedTransfers.length > 0, true);
  });
});

type Fixture = typeof fixture;

type ContributionRecord = {
  id: string;
  orgId: string;
  amount: Decimal;
  source: string;
  payload?: unknown;
  actorId?: string;
  appliedAt: Date | null;
  transferId?: string | null;
};

type AlertRecord = {
  id: string;
  orgId: string;
  type: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  resolvedAt: Date | null;
};

function createCompliancePrisma(fixtureData: Fixture) {
  const payroll: ContributionRecord[] = [];
  const pos: ContributionRecord[] = [];
  const idempotencyKeys: Array<{ orgId: string; key: string }> = [];
  const alerts: AlertRecord[] = [];
  const transfers: Array<{ id: string; orgId: string; accountId: string; amount: Decimal }> = [];

  const designatedAccounts = [
    {
      id: "acct-paygw",
      orgId: fixtureData.orgId,
      type: "PAYGW_BUFFER",
      balance: new Decimal(2000),
      locked: false,
      lockedAt: null as Date | null,
      updatedAt: new Date(),
    },
    {
      id: "acct-gst",
      orgId: fixtureData.orgId,
      type: "GST_BUFFER",
      balance: new Decimal(800),
      locked: false,
      lockedAt: null as Date | null,
      updatedAt: new Date(),
    },
  ];

  const basCycle = {
    id: fixtureData.basCycle.id,
    orgId: fixtureData.orgId,
    periodStart: new Date(fixtureData.basCycle.periodStart),
    periodEnd: new Date(fixtureData.basCycle.periodEnd),
    paygwRequired: new Decimal(fixtureData.basCycle.paygwRequired),
    gstRequired: new Decimal(fixtureData.basCycle.gstRequired),
    paygwSecured: new Decimal(0),
    gstSecured: new Decimal(0),
    overallStatus: "PENDING",
    lodgedAt: null as Date | null,
    paymentPlanRequests: [],
  };

  const prisma = {
    payrollContribution: {
      create: async ({ data }: any) => {
        payroll.push({
          id: data.id ?? `payroll-${payroll.length + 1}`,
          orgId: data.orgId,
          amount: toDecimal(data.amount),
          source: data.source,
          payload: data.payload,
          actorId: data.actorId,
          appliedAt: null,
          transferId: null,
        });
      },
      findMany: async ({ where }: any) => {
        return payroll.filter((entry) => {
          if (where?.orgId && entry.orgId !== where.orgId) {
            return false;
          }
          if ("appliedAt" in (where ?? {})) {
            const { appliedAt } = where;
            if (appliedAt?.equals === null) {
              return entry.appliedAt === null;
            }
          }
          return entry.appliedAt === null;
        });
      },
      update: async ({ where, data }: any) => {
        const record = payroll.find((entry) => entry.id === where.id);
        if (record) {
          record.appliedAt = data.appliedAt ?? record.appliedAt;
          record.transferId = data.transferId ?? record.transferId;
        }
      },
      aggregate: async ({ where }: any) => {
        const relevant = payroll.filter((entry) => {
          if (where?.orgId && entry.orgId !== where.orgId) {
            return false;
          }
          if (where?.appliedAt?.not === null) {
            return entry.appliedAt !== null;
          }
          return true;
        });
        const sum = relevant.reduce((total, entry) => total + Number(entry.amount), 0);
        return { _sum: { amount: sum } };
      },
    },
    posTransaction: {
      create: async ({ data }: any) => {
        pos.push({
          id: data.id ?? `pos-${pos.length + 1}`,
          orgId: data.orgId,
          amount: toDecimal(data.amount),
          source: data.source,
          payload: data.payload,
          actorId: data.actorId,
          appliedAt: null,
          transferId: null,
        });
      },
      findMany: async ({ where }: any) => {
        return pos.filter((entry) => {
          if (where?.orgId && entry.orgId !== where.orgId) {
            return false;
          }
          if ("appliedAt" in (where ?? {})) {
            const { appliedAt } = where;
            if (appliedAt?.equals === null) {
              return entry.appliedAt === null;
            }
          }
          return entry.appliedAt === null;
        });
      },
      update: async ({ where, data }: any) => {
        const record = pos.find((entry) => entry.id === where.id);
        if (record) {
          record.appliedAt = data.appliedAt ?? record.appliedAt;
          record.transferId = data.transferId ?? record.transferId;
        }
      },
      aggregate: async ({ where }: any) => {
        const relevant = pos.filter((entry) => {
          if (where?.orgId && entry.orgId !== where.orgId) {
            return false;
          }
          if (where?.appliedAt?.not === null) {
            return entry.appliedAt !== null;
          }
          return true;
        });
        const sum = relevant.reduce((total, entry) => total + Number(entry.amount), 0);
        return { _sum: { amount: sum } };
      },
    },
    idempotencyKey: {
      findUnique: async ({ where }: any) =>
        idempotencyKeys.find(
          (entry) => entry.orgId === where.orgId_key.orgId && entry.key === where.orgId_key.key,
        ) ?? null,
      create: async ({ data }: any) => {
        idempotencyKeys.push({ orgId: data.orgId, key: data.key });
      },
      update: async () => {},
    },
    designatedAccount: {
      findFirst: async ({ where }: any) =>
        designatedAccounts.find(
          (account) => account.orgId === where.orgId && account.type === where.type,
        ) ?? null,
      findUnique: async ({ where }: any) =>
        designatedAccounts.find((account) => account.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const record = designatedAccounts.find((account) => account.id === where.id);
        if (!record) return null;
        if (data.balance) {
          record.balance = toDecimal(data.balance);
        }
        if (typeof data.locked === "boolean") {
          record.locked = data.locked;
        }
        if ("lockedAt" in data) {
          record.lockedAt = data.lockedAt ?? null;
        }
        record.updatedAt = data.updatedAt ?? record.updatedAt;
        return record;
      },
    },
    designatedTransfer: {
      create: async ({ data }: any) => {
        const entry = {
          id: data.id ?? `transfer-${transfers.length + 1}`,
          orgId: data.orgId,
          accountId: data.accountId,
          amount: toDecimal(data.amount),
        };
        transfers.push(entry);
        return entry;
      },
      findMany: async () => transfers,
    },
    basCycle: {
      findFirst: async () => basCycle,
      findMany: async () => [basCycle],
    },
    alert: {
      create: async ({ data }: any) => {
        const entry: AlertRecord = {
          id: `alert-${alerts.length + 1}`,
          orgId: data.orgId,
          type: data.type,
          severity: data.severity,
          message: data.message,
          metadata: data.metadata ?? null,
          resolvedAt: null,
        };
        alerts.push(entry);
        return entry;
      },
      findMany: async ({ where }: any) => {
        return alerts.filter((alert) => {
          if (where?.orgId && alert.orgId !== where.orgId) {
            return false;
          }
          if (where?.resolvedAt?.equals === null) {
            return alert.resolvedAt === null;
          }
          return true;
        });
      },
      findUnique: async ({ where }: any) => alerts.find((alert) => alert.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const record = alerts.find((alert) => alert.id === where.id);
        if (record) {
          record.resolvedAt = data.resolvedAt ?? record.resolvedAt;
          record.metadata = { ...(record.metadata ?? {}), ...(data.metadata ?? {}) };
        }
        return record;
      },
    },
    org: {
      findMany: async () => [{ id: fixtureData.orgId }],
    },
    $transaction: async (handler: any) => handler(prisma),
  };

  return { prisma, state: { alerts, designatedTransfers: transfers } };
}

function toDecimal(value: any) {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value ?? 0);
}
