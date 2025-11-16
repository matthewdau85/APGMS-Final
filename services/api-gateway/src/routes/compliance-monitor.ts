import { type FastifyInstance, type FastifyPluginAsync, type FastifyRequest } from "fastify";
import { parseWithSchema } from "../lib/validation.js";
import {
  recordPayrollContribution,
  recordPosTransaction,
  summarizeContributions,
} from "@apgms/shared/ledger/ingest.js";
import {
  ensureDesignatedAccountCoverage,
  reconcileAccountSnapshot,
  releaseAccountLock,
} from "@apgms/shared/ledger/designated-account.js";
import {
  logSecurityEvent,
  buildSecurityContextFromRequest,
  buildSecurityLogEntry,
} from "@apgms/shared/security-log.js";
import { recordAuditLog } from "../lib/audit.js";
import { prisma } from "../db.js";
import {
  contributionSchema,
  precheckSchema,
} from "../schemas/designated-ingest.js";
import { complianceTransferSchema } from "../schemas/compliance-transfer.js";
import {
  forecastObligations,
  computeTierStatus,
  type ForecastResult,
  type TierStatus,
} from "@apgms/shared/ledger/predictive.js";
import { applyDesignatedAccountTransfer } from "@apgms/domain-policy";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { requireRecentVerification } from "../security/mfa.js";

const REMEDIATION_GUIDANCE =
  "Re-ingest missing payroll/POS batches, rerun the reconciliation job, and capture the remediation evidence before BAS lodgment.";

const complianceArtifactDir = path.join(process.cwd(), "artifacts", "compliance");
const partnerInfoFile = path.join(complianceArtifactDir, "partner-info.json");
const tierStateDir = path.join(complianceArtifactDir, "tier-state");
const tierSnapshotDir = path.join(tierStateDir, "snapshots");
const tierHistoryDir = path.join(complianceArtifactDir, "tier-history");
const tierWebhookLogFile = path.join(complianceArtifactDir, "tier-webhook-log.jsonl");
const partnerWebhookLogFile = path.join(complianceArtifactDir, "partner-webhook-events.jsonl");
const partnerConfirmationFile = path.join(complianceArtifactDir, "partner-confirmations.json");

function ensureArtifactDir(): void {
  fs.mkdirSync(complianceArtifactDir, { recursive: true });
}

function ensureTierDir(): void {
  ensureArtifactDir();
  fs.mkdirSync(tierStateDir, { recursive: true });
}

function ensureTierSnapshotDir(): void {
  ensureTierDir();
  fs.mkdirSync(tierSnapshotDir, { recursive: true });
}

function ensureTierHistoryDir(): void {
  ensureArtifactDir();
  fs.mkdirSync(tierHistoryDir, { recursive: true });
}

function appendJsonLine(file: string, payload: Record<string, unknown>): void {
  ensureArtifactDir();
  fs.appendFileSync(file, `${JSON.stringify(payload)}\n`);
}

function recordTierEvidence(
  orgId: string,
  tierStatus: Record<string, TierStatus>,
  forecast: ForecastResult,
  req: FastifyRequest,
): void {
  const timestamp = Date.now();
  const snapshot = {
    orgId,
    tierStatus,
    forecast,
    diagnostics: forecast.diagnostics,
    recordedAt: new Date(timestamp).toISOString(),
    source: req.routeOptions?.url ?? req.raw.url ?? "unknown",
  };
  ensureTierSnapshotDir();
  fs.writeFileSync(
    path.join(tierSnapshotDir, `${timestamp}-${orgId}.json`),
    JSON.stringify(snapshot, null, 2),
  );
  ensureTierHistoryDir();
  fs.writeFileSync(
    path.join(tierHistoryDir, `${timestamp}-${orgId}.json`),
    JSON.stringify(snapshot, null, 2),
  );
}

function readPartnerConfirmations(orgId?: string): Array<Record<string, any>> {
  if (!fs.existsSync(partnerConfirmationFile)) {
    return [];
  }
  try {
    const payload = JSON.parse(fs.readFileSync(partnerConfirmationFile, "utf8")) as {
      confirmations?: Array<Record<string, unknown>>;
    };
    const confirmations = Array.isArray(payload.confirmations) ? payload.confirmations : [];
    if (!orgId) {
      return confirmations;
    }
    return confirmations.filter((entry) => entry.orgId === orgId);
  } catch {
    return [];
  }
}

function readPilotReports(orgId?: string, limit = 10): Array<Record<string, any> & { file: string }> {
  ensureArtifactDir();
  const files = fs
    .readdirSync(complianceArtifactDir)
    .filter((name) => name.startsWith("pilot-report") && name.endsWith(".json"))
    .sort();
  const selected = files.slice(-limit);
  const reports = selected
    .map((file) => {
      try {
        const payload = JSON.parse(
          fs.readFileSync(path.join(complianceArtifactDir, file), "utf8"),
        ) as Record<string, unknown>;
        return { file, ...payload };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is Record<string, unknown> & { file: string } => Boolean(entry));
  if (!orgId) {
    return reports;
  }
  return reports.filter((entry) => entry.orgId === orgId);
}

function sanitizeHeaders(headers: FastifyRequest["headers"]) {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value !== "string") continue;
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "x-partner-token") {
      safe[key] = "***redacted***";
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

async function dispatchTierEscalationWebhook(params: {
  orgId: string;
  alertId: string;
  tierStatus: Record<string, TierStatus>;
  forecast: ForecastResult;
}): Promise<void> {
  const url = process.env.TIER_ESCALATION_WEBHOOK_URL?.trim();
  if (!url) {
    return;
  }
  const token = process.env.TIER_ESCALATION_WEBHOOK_TOKEN?.trim();
  const body = {
    alertId: params.alertId,
    orgId: params.orgId,
    tierStatus: params.tierStatus,
    forecast: params.forecast,
    recordedAt: new Date().toISOString(),
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["X-Tier-Webhook-Token"] = token;
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    appendJsonLine(tierWebhookLogFile, {
      timestamp: new Date().toISOString(),
      url,
      status: response.status,
      orgId: params.orgId,
    });
  } catch (error) {
    appendJsonLine(tierWebhookLogFile, {
      timestamp: new Date().toISOString(),
      url,
      error: error instanceof Error ? error.message : "webhook_failed",
      orgId: params.orgId,
    });
  }
}

function readTierState(orgId: string) {
  const file = path.join(tierStateDir, `${orgId}.json`);
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as {
      tierStatus: Record<string, TierStatus>;
      updatedAt: string;
    };
  } catch {
    return null;
  }
}

function writeTierState(orgId: string, tierStatus: Record<string, TierStatus>) {
  ensureTierDir();
  const file = path.join(tierStateDir, `${orgId}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ tierStatus, updatedAt: new Date().toISOString() }, null, 2),
  );
}

async function issueTierEscalationAlert(
  orgId: string,
  forecast: ForecastResult,
  tierStatus: Record<string, TierStatus>,
  req: FastifyRequest,
) {
  recordTierEvidence(orgId, tierStatus, forecast, req);
  const previous = readTierState(orgId);
  const escalateNow = Object.values(tierStatus).some((tier) => tier === "escalate");
  const previouslyEscalated = previous
    ? Object.values(previous.tierStatus).some((tier) => tier === "escalate")
    : false;
  if (!escalateNow || previouslyEscalated) {
    writeTierState(orgId, tierStatus);
    return null;
  }

  const alert = await prisma.alert.create({
    data: {
      orgId,
      type: "TIER_ESCALATION",
      severity: "HIGH",
      message: `Tier escalation (${Object.entries(tierStatus)
        .map(([key, value]) => `${key.toUpperCase()}=${value}`)
        .join(", ")})`,
      metadata: {
        forecast,
        tierStatus,
      },
    },
  });

  writeTierState(orgId, tierStatus);

  logSecurityEvent(
    req.log,
    buildSecurityLogEntry(
      {
        event: "tier.escalation",
        orgId,
        principal: (req.user as any)?.sub ?? "system",
        metadata: {
          alertId: alert.id,
          forecast,
          tierStatus,
        },
      },
      buildSecurityContextFromRequest(req),
    ),
  );

  await dispatchTierEscalationWebhook({
    alertId: alert.id,
    orgId,
    tierStatus,
    forecast,
  });

  return alert;
}

function logPartnerMetadata(): Record<string, unknown> | null {
  const partnerUrl = process.env.DESIGNATED_BANKING_URL?.trim();
  if (!partnerUrl) {
    return null;
  }
  ensureArtifactDir();
  const productId = process.env.DSP_PRODUCT_ID?.trim() ?? null;
  const fingerprint = process.env.DESIGNATED_BANKING_CERT_FINGERPRINT?.trim() ?? null;
  const entry = {
    timestamp: new Date().toISOString(),
    partnerUrl,
    productId,
    fingerprint,
  };
  fs.writeFileSync(partnerInfoFile, JSON.stringify(entry, null, 2));
  return entry;
}

function readPartnerMetadata(): Record<string, unknown> | null {
  if (!fs.existsSync(partnerInfoFile)) {
    return null;
  }
  try {
    const text = fs.readFileSync(partnerInfoFile, "utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function buildPilotReport(payload: {
  orgId: string;
  transfers: TransferRecord[];
  alerts: Awaited<ReturnType<typeof prisma.alert.findMany>>;
  reminderCycles: Awaited<ReturnType<typeof prisma.basCycle.findMany>>;
}) {
  ensureArtifactDir();
  const file = path.join(
    complianceArtifactDir,
    `pilot-report-${Date.now()}.json`,
  );
  const base = {
    timestamp: new Date().toISOString(),
    orgId: payload.orgId,
    transfers: payload.transfers,
    alerts: payload.alerts.map((alert) => ({
      id: alert.id,
      message: alert.message,
      severity: alert.severity,
      resolvedAt: alert.resolvedAt,
    })),
    reminders: payload.reminderCycles.map((cycle) => ({
      id: cycle.id,
      due: cycle.periodEnd.toISOString(),
      status: cycle.paymentPlanRequests.length > 0 ? "payment_plan" : "pending",
    })),
  };
  fs.writeFileSync(file, JSON.stringify(base, null, 2));
}
function contributionLog(
  app: FastifyInstance,
  req: FastifyRequest,
  payload: z.infer<typeof contributionSchema>,
  source: "payroll" | "pos",
): void {
  const context = buildSecurityContextFromRequest(req);
  const entry = buildSecurityLogEntry(
    {
      event: "designated.ingest",
      orgId: payload.orgId,
      principal: (req.user as any)?.sub ?? "system",
      metadata: {
        amount: payload.amount,
        source,
        payload: payload.payload,
        idempotencyKey: req.headers["idempotency-key"] as string | undefined,
      },
    },
    context,
  );
  logSecurityEvent(app.log, entry);
}

function resolveOrgId(req: FastifyRequest): string | undefined {
  return (req.user as any)?.orgId ?? undefined;
}

async function fetchPendingContributions(orgId: string) {
  const [payroll, pos] = await Promise.all([
    prisma.payrollContribution.findMany({
      where: { orgId, appliedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.posTransaction.findMany({
      where: { orgId, appliedAt: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return [
    ...payroll.map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount),
      source: entry.source,
      type: "PAYGW",
      createdAt: entry.createdAt,
    })),
    ...pos.map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount),
      source: entry.source,
      type: "GST",
      createdAt: entry.createdAt,
    })),
  ];
}

async function recordTransferAudit(entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}) {
  await recordAuditLog({
    orgId: entry.orgId,
    actorId: entry.actorId,
    action: entry.action,
    metadata: entry.metadata,
  });
}

type TransferRecord = {
  type: "PAYGW" | "GST";
  amount: number;
  transferId: string;
  accountId: string;
};

async function executeTransfer(
  orgId: string,
  account: Awaited<ReturnType<typeof ensureDesignatedAccountCoverage>>,
  amount: number,
  actor: string,
  description: string,
  type: "PAYGW" | "GST",
): Promise<TransferRecord> {
  const result = await applyDesignatedAccountTransfer(
    {
      prisma,
      auditLogger: (audit) =>
        recordTransferAudit({ orgId, actorId: actor, action: audit.action, metadata: audit.metadata ?? {} }),
    },
    {
      orgId,
      accountId: account.id,
      amount,
      source: "bas_transfer",
      actorId: actor,
    },
  );

  return {
    type,
    amount,
    transferId: result.transferId,
    accountId: account.id,
  };
}

export const registerComplianceMonitorRoutes: FastifyPluginAsync = async (app) => {
  app.post("/ingest/payroll", async (req, reply) => {
    const contribution = parseWithSchema(contributionSchema, req.body);
    await recordPayrollContribution({
      prisma,
      orgId: contribution.orgId,
      amount: contribution.amount,
      actorId: contribution.actorId,
      payload: contribution.payload,
      idempotencyKey: req.headers["idempotency-key"] as string | undefined,
    });
    contributionLog(app, req, contribution, "payroll");
    reply.code(202).send({ status: "queued" });
  });

  app.post("/ingest/pos", async (req, reply) => {
    const contribution = parseWithSchema(contributionSchema, req.body);
    await recordPosTransaction({
      prisma,
      orgId: contribution.orgId,
      amount: contribution.amount,
      actorId: contribution.actorId,
      payload: contribution.payload,
      idempotencyKey: req.headers["idempotency-key"] as string | undefined,
    });
    contributionLog(app, req, contribution, "pos");
    reply.code(202).send({ status: "queued" });
  });

  app.get("/compliance/pending", async (req, reply) => {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }
    const pending = await fetchPendingContributions(orgId);
    reply.send({
      orgId,
      pending,
      guidance:
        "Submit missing payroll/POS payloads with Idempotency-Key headers and rerun /compliance/precheck.",
    });
  });

  app.post("/compliance/precheck", async (req, reply) => {
    const body = parseWithSchema(precheckSchema, req.body);
    const orgId = body.orgId ?? resolveOrgId(req);
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }

    const latest = await prisma.basCycle.findFirst({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "desc" },
    });
    if (!latest) {
      reply.code(404).send({ error: "bas_cycle_missing" });
      return;
    }

    const summary = await summarizeContributions(prisma, orgId);
    const forecast = await forecastObligations(prisma, orgId);
    const result: Record<string, unknown> = {
      orgId,
      cycleId: latest.id,
      paygwRequired: Number(latest.paygwRequired),
      gstRequired: Number(latest.gstRequired),
      paygwSecured: summary.paygwSecured,
      gstSecured: summary.gstSecured,
      cycleStart: latest.periodStart,
      cycleEnd: latest.periodEnd,
      forecast,
      tierStatus: {
        paygw: computeTierStatus(summary.paygwSecured, forecast.paygwForecast),
        gst: computeTierStatus(summary.gstSecured, forecast.gstForecast),
      },
    };

    try {
      const paygwAccount = await ensureDesignatedAccountCoverage(
        prisma,
        orgId,
        "PAYGW_BUFFER",
        Number(latest.paygwRequired),
      );
      const gstAccount = await ensureDesignatedAccountCoverage(
        prisma,
        orgId,
        "GST_BUFFER",
        Number(latest.gstRequired),
      );
      await releaseAccountLock(prisma, paygwAccount.id);
      await releaseAccountLock(prisma, gstAccount.id);
      reply.send({ ...result, status: "ready" });
    } catch (error) {
      const pending = await fetchPendingContributions(orgId);
      reply.code(409).send({
        ...result,
        status: "shortfall",
        error: error instanceof Error ? error.message : "shortfall_detected",
        errorCode: (error as any)?.code ?? "designated_shortfall",
        pendingContributions: pending,
        remediation: REMEDIATION_GUIDANCE,
      });
    }
  });

  app.post("/compliance/transfer", async (req, reply) => {
    const body = parseWithSchema(complianceTransferSchema, req.body);
    const orgId = body.orgId ?? resolveOrgId(req);
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }

    const principalId = (req.user as any)?.sub as string | undefined;
    if (!principalId) {
      reply.code(401).send({ error: "principal_missing" });
      return;
    }

    if (!requireRecentVerification(principalId)) {
      reply.code(403).send({
        error: "mfa_required",
        message:
          "Step-up MFA verification is required before initiating compliance transfers. Use /auth/mfa/step-up and retry within 10 minutes.",
      });
      return;
    }

    if (body.paygwAmount <= 0 && body.gstAmount <= 0) {
      reply.code(400).send({ error: "no_transfer_amount" });
      return;
    }

    const latest = await prisma.basCycle.findFirst({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "desc" },
    });
    if (!latest) {
      reply.code(404).send({ error: "bas_cycle_missing" });
      return;
    }

    const cycleContext = {
      cycleId: latest.id,
      description: body.description ?? "BAS transfer",
    };

    const transfers: TransferRecord[] = [];
    const principal = principalId;

    if (body.paygwAmount > 0) {
      const account = await ensureDesignatedAccountCoverage(
        prisma,
        orgId,
        "PAYGW_BUFFER",
        body.paygwAmount,
        cycleContext,
      );
      transfers.push(
        await executeTransfer(
          orgId,
          account,
          body.paygwAmount,
          principal,
          body.description ?? "BAS transfer",
          "PAYGW",
        ),
      );
    }

    if (body.gstAmount > 0) {
      const account = await ensureDesignatedAccountCoverage(
        prisma,
        orgId,
        "GST_BUFFER",
        body.gstAmount,
        cycleContext,
      );
      transfers.push(
        await executeTransfer(
          orgId,
          account,
          body.gstAmount,
          principal,
          body.description ?? "BAS transfer",
          "GST",
        ),
      );
    }

    const forecast = await forecastObligations(prisma, orgId);
    const tierStatus = {
      paygw: computeTierStatus(
        transfers.find((tran) => tran.type === "PAYGW")?.amount ?? 0,
        forecast.paygwForecast,
        forecast.paygwForecast * 0.1,
      ),
      gst: computeTierStatus(
        transfers.find((tran) => tran.type === "GST")?.amount ?? 0,
        forecast.gstForecast,
        forecast.gstForecast * 0.1,
      ),
    };

    const reminderCycles = await prisma.basCycle.findMany({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "asc" },
      take: 3,
    });
    const afterAlerts = await prisma.alert.findMany({
      where: { orgId, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    await buildPilotReport({
      orgId,
      transfers,
      alerts: afterAlerts,
      reminderCycles,
    });

    logPartnerMetadata();

    const logEntry = buildSecurityLogEntry(
      {
        event: "designated.transfer",
        orgId,
        principal,
        metadata: {
          transfers,
          description: body.description ?? "BAS transfer",
          cycleId: latest.id,
        },
      },
      buildSecurityContextFromRequest(req),
    );
    logSecurityEvent(app.log, logEntry);

    reply.send({
      status: "transferred",
      transfers,
      forecast,
      tierStatus,
      nextSteps: REMEDIATION_GUIDANCE,

    });
  });

  app.get("/compliance/status", async (req, reply) => {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }

    const forecast = await forecastObligations(prisma, orgId);

    const accountPromises = (["PAYGW_BUFFER", "GST_BUFFER"] as const).map(
      async (type) => {
        try {
          const snapshot = await reconcileAccountSnapshot(prisma, orgId, type);
          return {
            type,
            balance: snapshot.balance,
            updatedAt: snapshot.updatedAt,
            error: null,
          };
        } catch (accountError) {
          return {
            type,
            balance: 0,
            updatedAt: new Date(0),
            error: accountError instanceof Error
              ? accountError.message
              : "account_unavailable",
          };
        }
      },
    );
    const accounts = await Promise.all(accountPromises);
    const alerts = await prisma.alert.findMany({
      where: { orgId, type: "DESIGNATED_FUNDS_SHORTFALL", resolvedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const summary = await summarizeContributions(prisma, orgId);
    const pending = await fetchPendingContributions(orgId);

    const tierStatuses = {
      paygw: computeTierStatus(
        accounts.find((entry) => entry.type === "PAYGW_BUFFER")?.balance ?? 0,
        forecast.paygwForecast,
        forecast.paygwForecast * 0.1,
      ),
      gst: computeTierStatus(
        accounts.find((entry) => entry.type === "GST_BUFFER")?.balance ?? 0,
        forecast.gstForecast,
        forecast.gstForecast * 0.1,
      ),
    };

    const partnerStatus =
      readPartnerMetadata() ?? {
        url: process.env.DESIGNATED_BANKING_URL ?? null,
        productId: process.env.DSP_PRODUCT_ID ?? null,
      };
    const escalationAlert = await issueTierEscalationAlert(orgId, forecast, tierStatuses, req);
    reply.send({
      accounts: accounts.map((account) => ({
        type: account.type,
        balance: account.balance,
        updatedAt: account.updatedAt,
        locked: account.locked,
        error: account.error,
      })),
      contributions: summary,
      pendingContributions: pending,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        message: alert.message,
        severity: alert.severity,
        since: alert.createdAt,
      })),
      forecast,
      tierStatus: tierStatuses,
      remediation:
        pending.length > 0 ? REMEDIATION_GUIDANCE : "Buffers are healthy and ready for BAS.",
      partnerStatus,
      escalationAlertId: escalationAlert?.id ?? null,
    });
  });

  app.get("/compliance/pilot-status", async (req, reply) => {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }
    const partnerStatus =
      readPartnerMetadata() ?? {
        url: process.env.DESIGNATED_BANKING_URL ?? null,
        productId: process.env.DSP_PRODUCT_ID ?? null,
      };
    const pilots = readPilotReports(orgId, 10).map((entry) => ({
      file: entry.file,
      orgId: entry.orgId,
      timestamp: entry.timestamp,
      transfers: entry.transfers,
      alerts: entry.alerts,
      reminders: entry.reminders,
      pilot: entry.pilot ?? null,
    }));
    reply.send({
      orgId,
      pilots,
      pilotCount: pilots.length,
      partnerStatus,
      dspProductId: partnerStatus?.productId ?? process.env.DSP_PRODUCT_ID ?? null,
    });
  });

  app.get("/compliance/reconciliation", async (req, reply) => {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }
    const [latestCycle, transfers] = await Promise.all([
      prisma.basCycle.findFirst({
        where: { orgId },
        orderBy: { periodEnd: "desc" },
      }),
      prisma.designatedTransfer.findMany({
        where: { orgId },
        include: { account: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const totals = transfers.reduce(
      (acc, transfer) => {
        const type = transfer.account.type;
        if (type === "PAYGW_BUFFER") {
          acc.paygw += Number(transfer.amount);
        } else if (type === "GST_BUFFER") {
          acc.gst += Number(transfer.amount);
        }
        return acc;
      },
      { paygw: 0, gst: 0 },
    );

    const cycleDetails = latestCycle
      ? {
          id: latestCycle.id,
          periodStart: latestCycle.periodStart,
          periodEnd: latestCycle.periodEnd,
          status: latestCycle.overallStatus,
          paygwRequired: Number(latestCycle.paygwRequired),
          gstRequired: Number(latestCycle.gstRequired),
        }
      : null;

    const confirmations = readPartnerConfirmations(orgId);
    const cycleConfirmation = cycleDetails
      ? confirmations.find((entry) => entry.cycleId === cycleDetails.id)
      : null;

    const partnerVariance = cycleDetails && cycleConfirmation
      ? {
          paygw:
            Number(cycleConfirmation.paygwConfirmed ?? 0) -
            cycleDetails.paygwRequired,
          gst:
            Number(cycleConfirmation.gstConfirmed ?? 0) -
            cycleDetails.gstRequired,
        }
      : null;

    reply.send({
      orgId,
      basCycle: cycleDetails,
      designatedTransferTotals: totals,
      variances:
        cycleDetails
          ? {
              paygw: totals.paygw - cycleDetails.paygwRequired,
              gst: totals.gst - cycleDetails.gstRequired,
            }
          : null,
      partnerConfirmations: confirmations,
      partnerVariance,
    });
  });

  app.post("/compliance/tier-check", async (req, reply) => {
    const orgs = await prisma.org.findMany({ select: { id: true } });
    const results = [];
    for (const { id } of orgs) {
      const forecast = await forecastObligations(prisma, id);
      const accounts = await Promise.all(
        (["PAYGW_BUFFER", "GST_BUFFER"] as const).map(async (type) => {
          const snapshot = await reconcileAccountSnapshot(prisma, id, type);
          return snapshot;
        }),
      );
      const tierStatuses = {
        paygw: computeTierStatus(
          accounts.find((entry) => entry.account.type === "PAYGW_BUFFER")?.balance ?? 0,
          forecast.paygwForecast,
          forecast.paygwForecast * 0.1,
        ),
        gst: computeTierStatus(
          accounts.find((entry) => entry.account.type === "GST_BUFFER")?.balance ?? 0,
          forecast.gstForecast,
          forecast.gstForecast * 0.1,
        ),
      };
      const alert = await issueTierEscalationAlert(id, forecast, tierStatuses, req);
      results.push({
        orgId: id,
        tierStatus: tierStatuses,
        forecast,
        escalationAlertId: alert?.id ?? null,
      });
    }
    reply.send({ results });
  });

  app.post("/compliance/partner-webhook", async (req, reply) => {
    const token = process.env.PARTNER_WEBHOOK_TOKEN?.trim();
    const provided = (req.headers["x-partner-token"] ?? "").toString();
    if (token && provided !== token) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const payload = typeof req.body === "object" ? req.body : { raw: req.body };
    appendJsonLine(partnerWebhookLogFile, {
      timestamp: new Date().toISOString(),
      headers: sanitizeHeaders(req.headers),
      payload,
      ip: req.ip,
    });
    logSecurityEvent(
      app.log,
      buildSecurityLogEntry(
        {
          event: "partner.webhook.received",
          orgId: (req.user as any)?.orgId ?? "partner",
          principal: (req.headers["x-partner-id"] as string) ?? "partner-webhook",
          metadata: {
            headers: sanitizeHeaders(req.headers),
            hasSignature: Boolean(provided),
          },
        },
        buildSecurityContextFromRequest(req),
      ),
    );
    reply.send({ status: "logged" });
  });

  app.post("/compliance/alerts/:id/resolve", async (req, reply) => {
    const alertId = (req.params as { id: string }).id;
    const principal = (req.user as any)?.sub ?? "system";
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) {
      reply.code(404).send({ error: "alert_not_found" });
      return;
    }

    await prisma.alert.update({
      where: { id: alertId },
      data: {
        resolvedAt: new Date(),
        metadata: {
          ...(alert.metadata ?? {}),
          resolvedBy: principal,
          resolvedAt: new Date().toISOString(),
        },
      },
    });

    const entry = buildSecurityLogEntry(
      {
        event: "designated.alert.resolved",
        orgId: alert.orgId,
        principal,
        metadata: {
          alertId,
          message: alert.message,
        },
      },
      buildSecurityContextFromRequest(req),
    );
    logSecurityEvent(app.log, entry);

    reply.send({ status: "resolved", alertId });
  });

  app.get("/compliance/reminders", async (req, reply) => {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }

    const cycles = await prisma.basCycle.findMany({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "asc" },
      take: 3,
    });
    const now = Date.now();
    reply.send(
      cycles.map((cycle) => ({
        cycleId: cycle.id,
        dueInMs: cycle.periodEnd.getTime() - now,
        dueInDays: Math.max(0, Math.ceil((cycle.periodEnd.getTime() - now) / (1000 * 60 * 60 * 24))),
        status: cycle.paymentPlanRequests.length > 0 ? "payment_plan" : "pending",
      })),
    );
  });
};

export default registerComplianceMonitorRoutes;
