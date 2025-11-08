import { Prisma } from "@prisma/client";

import { prisma } from "@apgms/shared/db.js";

const WINDOW_DAYS = 30;

function subtractDays(reference: Date, days: number): Date {
  const copy = new Date(reference.getTime());
  copy.setDate(copy.getDate() - days);
  return copy;
}

function safeNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function runAnalyticsFeatureAggregation(): Promise<void> {
  const asOf = new Date();
  const windowStart = subtractDays(asOf, WINDOW_DAYS);

  const organisations = await prisma.org.findMany({
    select: { id: true },
  });

  for (const org of organisations) {
    const policyEvents = await prisma.analyticsEvent.findMany({
      where: {
        orgId: org.id,
        domain: "policy",
        occurredAt: {
          gte: windowStart,
          lte: asOf,
        },
      },
    });

    let approvedCount = 0;
    let blockedCount = 0;
    let approvedAmount = 0;

    for (const event of policyEvents) {
      if (event.eventType === "designated_transfer.approved") {
        approvedCount += 1;
        approvedAmount += safeNumber((event.payload as Record<string, unknown>)?.amount);
      } else if (event.eventType === "designated_transfer.blocked") {
        blockedCount += 1;
      }
    }

    const ledgerEventCount = await prisma.analyticsEvent.count({
      where: {
        orgId: org.id,
        domain: "ledger",
        eventType: "journal.write",
        occurredAt: {
          gte: windowStart,
          lte: asOf,
        },
      },
    });

    const latestLedgerEvent = await prisma.analyticsEvent.findFirst({
      where: {
        orgId: org.id,
        domain: "ledger",
        eventType: "journal.write",
      },
      orderBy: { occurredAt: "desc" },
    });

    const designatedAccounts = await prisma.designatedAccount.findMany({
      where: { orgId: org.id },
    });

    const totalDesignatedBalance = designatedAccounts.reduce((sum, account) => {
      return sum + Number(account.balance);
    }, 0);

    const openViolationCount = await prisma.alert.count({
      where: {
        orgId: org.id,
        type: "DESIGNATED_WITHDRAWAL_ATTEMPT",
        resolvedAt: null,
      },
    });

    const features: Prisma.JsonObject = {
      designated_transfer_30d_count: approvedCount,
      designated_transfer_30d_total_amount: Number(approvedAmount.toFixed(2)),
      designated_transfer_violation_30d_count: blockedCount,
      ledger_journal_30d_count: ledgerEventCount,
      designated_balance_total: Number(totalDesignatedBalance.toFixed(2)),
      analytics_event_30d_count: policyEvents.length + ledgerEventCount,
      last_ledger_event_at: latestLedgerEvent?.occurredAt
        ? latestLedgerEvent.occurredAt.toISOString()
        : null,
    };

    const labels: Prisma.JsonObject = {
      has_open_designated_violation: openViolationCount > 0,
      designated_policy_status: openViolationCount > 0 ? "alert" : "clear",
      recent_transfer_activity:
        approvedCount === 0 ? "none" : approvedCount > 5 ? "high" : "moderate",
    };

    await prisma.analyticsFeatureSnapshot.create({
      data: {
        orgId: org.id,
        windowStart,
        asOf,
        features,
        labels,
      },
    });
  }
}
