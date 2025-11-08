import { Prisma } from "@prisma/client";

import { prisma } from "@apgms/shared/db.js";

type CheckResult = {
  name: string;
  ok: boolean;
  details: string;
};

function subtractDays(reference: Date, days: number): Date {
  const copy = new Date(reference.getTime());
  copy.setDate(copy.getDate() - days);
  return copy;
}

async function checkForNulls(): Promise<CheckResult> {
  const nullPayloadEvents = await prisma.analyticsEvent.count({
    where: { payload: { equals: Prisma.JsonNull } },
  });

  const nullSnapshots = await prisma.analyticsFeatureSnapshot.count({
    where: {
      OR: [
        { features: { equals: Prisma.JsonNull } },
        { labels: { equals: Prisma.JsonNull } },
      ],
    },
  });

  const ok = nullPayloadEvents === 0 && nullSnapshots === 0;

  return {
    name: "null-checks",
    ok,
    details: ok
      ? "No null payloads detected in analytics tables"
      : `Found ${nullPayloadEvents} events with null payloads and ${nullSnapshots} snapshots with null features/labels`.
  };
}

async function checkForDrift(): Promise<CheckResult> {
  const now = new Date();
  const recentStart = subtractDays(now, 7);
  const previousStart = subtractDays(recentStart, 7);

  const recent = await prisma.analyticsEvent.groupBy({
    by: ["eventType"],
    where: {
      occurredAt: { gt: recentStart, lte: now },
    },
    _count: { eventType: true },
  });

  const prior = await prisma.analyticsEvent.groupBy({
    by: ["eventType"],
    where: {
      occurredAt: { gt: previousStart, lte: recentStart },
    },
    _count: { eventType: true },
  });

  const priorMap = new Map(prior.map((entry) => [entry.eventType, entry._count.eventType]));
  const driftWarnings: string[] = [];

  for (const entry of recent) {
    const baseline = priorMap.get(entry.eventType) ?? 0;
    const change = baseline === 0 ? entry._count.eventType : Math.abs(entry._count.eventType - baseline) / baseline;

    if (baseline === 0 && entry._count.eventType >= 10) {
      driftWarnings.push(`${entry.eventType} has no historical baseline but ${entry._count.eventType} recent events`);
    } else if (baseline > 0 && change >= 0.5 && entry._count.eventType >= 10) {
      driftWarnings.push(`${entry.eventType} changed by ${(change * 100).toFixed(1)}% (baseline ${baseline}, recent ${entry._count.eventType})`);
    }
  }

  const ok = driftWarnings.length === 0;

  return {
    name: "drift-checks",
    ok,
    details: ok ? "No significant event volume drift detected" : driftWarnings.join("; "),
  };
}

async function checkForLabelLeakage(): Promise<CheckResult> {
  const now = new Date();
  const snapshots = await prisma.analyticsFeatureSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const issues: string[] = [];

  for (const snapshot of snapshots) {
    if (snapshot.asOf < snapshot.windowStart) {
      issues.push(`Snapshot ${snapshot.id} has asOf earlier than windowStart`);
    }

    if (snapshot.asOf.getTime() - now.getTime() > 5 * 60 * 1000) {
      issues.push(`Snapshot ${snapshot.id} is timestamped in the future`);
    }

    const futureEvents = await prisma.analyticsEvent.count({
      where: {
        orgId: snapshot.orgId,
        occurredAt: {
          gt: snapshot.asOf,
          lte: snapshot.createdAt,
        },
      },
    });

    if (futureEvents > 0) {
      issues.push(
        `Snapshot ${snapshot.id} has ${futureEvents} events recorded after asOf but before creation (potential leakage)`,
      );
    }
  }

  const ok = issues.length === 0;

  return {
    name: "label-leakage",
    ok,
    details: ok ? "No label leakage indicators detected" : issues.join("; "),
  };
}

async function main() {
  const checks = await Promise.all([
    checkForNulls(),
    checkForDrift(),
    checkForLabelLeakage(),
  ]);

  let hasFailure = false;

  for (const check of checks) {
    const status = check.ok ? "✅" : "❌";
    // eslint-disable-next-line no-console
    console.log(`${status} ${check.name}: ${check.details}`);
    if (!check.ok) {
      hasFailure = true;
    }
  }

  await prisma.$disconnect();

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Data quality checks failed", error);
  process.exitCode = 1;
});
