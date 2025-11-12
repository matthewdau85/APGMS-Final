import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";

import {
  aggregateDetectorConcentration,
  isDetectorConcentration,
  type DetectorConcentration,
  type DetectorFlaggedRow,
} from "@apgms/shared";

import { prisma } from "../db.js";
import { recordAuditLog } from "../lib/audit.js";

type RegulatorRequest = FastifyRequest & {
  user?: { orgId?: string; sub?: string };
  regulatorSession?: { id: string; orgId: string };
};

const MAX_SNAPSHOTS = 20;
const DETECTOR_CONCENTRATION_METRIC_KEY = "detector.concentration";

function ensureOrgId(request: RegulatorRequest): string {
  const orgId = request.user?.orgId ?? request.regulatorSession?.orgId;
  if (!orgId) {
    throw new Error("regulator_org_missing");
  }
  return orgId;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function extractFlaggedRows(payload: unknown): DetectorFlaggedRow[] {
  if (!isPlainObject(payload)) return [];
  const detectors = (payload as Record<string, unknown>).detectors;
  if (!isPlainObject(detectors)) return [];

  const detectorsRecord = detectors as Record<string, unknown>;
  const flaggedRows = (() => {
    const direct = detectorsRecord.flaggedRows;
    if (Array.isArray(direct)) {
      return direct;
    }
    const flagged = detectorsRecord.flagged;
    if (isPlainObject(flagged)) {
      const nested = (flagged as Record<string, unknown>).rows;
      if (Array.isArray(nested)) {
        return nested;
      }
    }
    return [];
  })();

  if (!Array.isArray(flaggedRows)) return [];

  const rows: DetectorFlaggedRow[] = [];
  for (const entry of flaggedRows) {
    if (!isPlainObject(entry)) continue;
    const entryRecord = entry as Record<string, unknown>;
    const vendorRaw =
      asString(entryRecord.vendor) ??
      asString(entryRecord.vendorName) ??
      asString(entryRecord.supplier) ??
      asString(entryRecord.supplierName);
    const approverRaw =
      asString(entryRecord.approver) ??
      asString(entryRecord.approverName) ??
      asString(entryRecord.reviewer) ??
      asString(entryRecord.reviewerName);

    if (
      (typeof vendorRaw === "string" && vendorRaw.trim().length > 0) ||
      (typeof approverRaw === "string" && approverRaw.trim().length > 0)
    ) {
      rows.push({ vendor: vendorRaw ?? null, approver: approverRaw ?? null });
    }
  }
  return rows;
}

function actorIdFrom(request: RegulatorRequest): string {
  return request.regulatorSession?.id ?? request.user?.sub ?? "regulator";
}

async function logRegulatorAction(
  request: RegulatorRequest,
  action: string,
  metadata?: Record<string, unknown | null>,
) {
  await recordAuditLog({
    orgId: ensureOrgId(request),
    actorId: actorIdFrom(request),
    action,
    metadata: metadata ?? null,
  });
}

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value);
}

function formatPeriod(start: Date, end: Date): string {
  return `${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}`;
}

export async function registerRegulatorRoutes(app: FastifyInstance) {
  app.get("/regulator/health", async (request: RegulatorRequest) => {
    await logRegulatorAction(request, "regulator.health");
    return { ok: true, service: "regulator" };
  });

  app.get("/regulator/compliance/report", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);

    const [
      basCycles,
      paymentPlans,
      openHighSeverity,
      resolvedThisQuarter,
      designatedAccounts,
    ] = await Promise.all([
      prisma.basCycle.findMany({
        where: { orgId },
        orderBy: { periodStart: "desc" },
      }),
      prisma.paymentPlanRequest.findMany({
        where: { orgId },
        orderBy: { requestedAt: "desc" },
      }),
      prisma.alert.count({
        where: { orgId, severity: "HIGH", resolvedAt: null },
      }),
      prisma.alert.count({
        where: {
          orgId,
          resolvedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.designatedAccount.findMany({ where: { orgId } }),
    ]);

    const basHistory = basCycles.map((cycle) => ({
      period: formatPeriod(cycle.periodStart, cycle.periodEnd),
      lodgedAt: cycle.lodgedAt?.toISOString() ?? null,
      status: cycle.overallStatus,
      notes: `PAYGW ${toNumber(cycle.paygwSecured)} / ${toNumber(cycle.paygwRequired)} · GST ${toNumber(cycle.gstSecured)} / ${toNumber(cycle.gstRequired)}`,
    }));

    const paymentPlanHistory = paymentPlans.map((plan) => ({
      id: plan.id,
      basCycleId: plan.basCycleId,
      requestedAt: plan.requestedAt.toISOString(),
      status: plan.status,
      reason: plan.reason,
      details: plan.detailsJson ?? {},
      resolvedAt: plan.resolvedAt?.toISOString() ?? null,
    }));

    const totals = designatedAccounts.reduce(
      (acc, account) => {
        if (account.type === "PAYGW") {
          acc.paygw += Number(account.balance ?? 0);
        } else if (account.type === "GST") {
          acc.gst += Number(account.balance ?? 0);
        }
        return acc;
      },
      { paygw: 0, gst: 0 },
    );

    const nextBasCycle = await prisma.basCycle.findFirst({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "asc" },
    });

    await logRegulatorAction(request, "regulator.compliance.report", {
      basPeriods: basHistory.length,
    });

    return {
      orgId,
      basHistory,
      paymentPlans: paymentPlanHistory,
      alertsSummary: {
        openHighSeverity,
        resolvedThisQuarter,
      },
      nextBasDue: nextBasCycle?.periodEnd?.toISOString() ?? null,
      designatedTotals: {
        paygw: totals.paygw,
        gst: totals.gst,
      },
    };
  });

  app.get("/regulator/alerts", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);
    const alerts = await prisma.alert.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });

    await logRegulatorAction(request, "regulator.alerts.list", { count: alerts.length });

    return {
      alerts: alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
        resolved: alert.resolvedAt != null,
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      })),
    };
  });

  app.get("/regulator/monitoring/snapshots", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);
    const limitParam = Number((request.query as { limit?: string | number }).limit ?? 5);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.trunc(limitParam), 1), MAX_SNAPSHOTS)
      : 5;

    const snapshots = await prisma.monitoringSnapshot.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const snapshotIds = snapshots.map((snapshot) => snapshot.id);
    const concentrationMetrics = snapshotIds.length
      ? await prisma.metric.findMany({
          where: {
            orgId,
            key: DETECTOR_CONCENTRATION_METRIC_KEY,
            scope: { in: snapshotIds },
          },
          orderBy: { recordedAt: "desc" },
        })
      : [];

    const concentrationByScope = new Map<string, DetectorConcentration>();
    for (const metric of concentrationMetrics) {
      if (!metric.scope || concentrationByScope.has(metric.scope)) continue;
      if (isDetectorConcentration(metric.data)) {
        concentrationByScope.set(metric.scope, metric.data);
      }
    }

    await logRegulatorAction(request, "regulator.monitoring.snapshots", { limit });

    const enrichedSnapshots = await Promise.all(
      snapshots.map(async (snapshot) => {
        const rawPayload = snapshot.payload as unknown;
        const payloadObject: Record<string, unknown> = isPlainObject(rawPayload)
          ? { ...rawPayload }
          : {};

        let concentration: DetectorConcentration | null =
          concentrationByScope.get(snapshot.id) ?? null;

        if (!concentration) {
          const existing = payloadObject["detectorConcentration"];
          if (isDetectorConcentration(existing)) {
            concentration = existing;
          }
        }

        if (!concentration) {
          const flaggedRows = extractFlaggedRows(rawPayload);
          if (flaggedRows.length > 0) {
            concentration = aggregateDetectorConcentration(flaggedRows);
            try {
              await prisma.metric.upsert({
                where: {
                  orgId_key_scope: {
                    orgId,
                    key: DETECTOR_CONCENTRATION_METRIC_KEY,
                    scope: snapshot.id,
                  },
                },
                update: {
                  data: concentration as unknown as Prisma.InputJsonValue,
                  recordedAt: snapshot.createdAt,
                },
                create: {
                  orgId,
                  key: DETECTOR_CONCENTRATION_METRIC_KEY,
                  scope: snapshot.id,
                  data: concentration as unknown as Prisma.InputJsonValue,
                  recordedAt: snapshot.createdAt,
                },
              });
              concentrationByScope.set(snapshot.id, concentration);
            } catch (error) {
              request.log?.error({ err: error, snapshotId: snapshot.id }, "detector_metric_write_failed");
            }
          }
        }

        payloadObject["detectorConcentration"] = concentration;

        return {
          id: snapshot.id,
          type: snapshot.type,
          createdAt: snapshot.createdAt.toISOString(),
          payload: payloadObject,
        };
      }),
    );

    return {
      snapshots: enrichedSnapshots,
    };
  });

  app.get("/regulator/evidence", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);
    const artifacts = await prisma.evidenceArtifact.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    await logRegulatorAction(request, "regulator.evidence.list", { count: artifacts.length });

    return {
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        sha256: artifact.sha256,
        wormUri: artifact.wormUri,
        createdAt: artifact.createdAt.toISOString(),
      })),
    };
  });

  app.get("/regulator/evidence/:artifactId", async (request: RegulatorRequest, reply) => {
    const orgId = ensureOrgId(request);
    const artifact = await prisma.evidenceArtifact.findUnique({
      where: { id: (request.params as { artifactId: string }).artifactId },
    });
    if (!artifact || artifact.orgId !== orgId) {
      reply.code(404).send({ error: "artifact_not_found" });
      return;
    }

    await logRegulatorAction(request, "regulator.evidence.detail", { artifactId: artifact.id });

    return {
      artifact: {
        id: artifact.id,
        kind: artifact.kind,
        sha256: artifact.sha256,
        wormUri: artifact.wormUri,
        createdAt: artifact.createdAt.toISOString(),
        payload: artifact.payload ?? null,
      },
    };
  });

  app.get("/regulator/bank-lines/summary", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);
    const [aggregate, firstEntry, lastEntry, recent] = await Promise.all([
      prisma.bankLine.aggregate({
        where: { orgId },
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.bankLine.findFirst({
        where: { orgId },
        orderBy: { date: "asc" },
      }),
      prisma.bankLine.findFirst({
        where: { orgId },
        orderBy: { date: "desc" },
      }),
      prisma.bankLine.findMany({
        where: { orgId },
        orderBy: { date: "desc" },
        take: 5,
      }),
    ]);

    await logRegulatorAction(request, "regulator.bank.summary", {
      entries: aggregate._count?.id ?? 0,
    });

    return {
      summary: {
        totalEntries: aggregate._count?.id ?? 0,
        totalAmount: Number(aggregate._sum?.amount ?? 0),
        firstEntryAt: firstEntry?.createdAt?.toISOString() ?? null,
        lastEntryAt: lastEntry?.createdAt?.toISOString() ?? null,
      },
      recent: recent.map((line) => ({
        id: line.id,
        date: line.date.toISOString(),
        amount: Number(line.amount),
      })),
    };
  });
}
