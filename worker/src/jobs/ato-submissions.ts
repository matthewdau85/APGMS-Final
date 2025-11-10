import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { prisma } from "@apgms/shared/db.js";
import { OAuth2Client } from "../../../services/connectors/src/index.js";
import { AtoClient } from "../../../services/ato-client/src/index.js";

const SYSTEM_ACTOR = "system";

function readEnv(name: string, fallback: string): string {
  return process.env[name] && process.env[name] !== ""
    ? process.env[name] as string
    : fallback;
}

function createAtoClientFromEnv(): AtoClient {
  const tokenUrl = readEnv("ATO_TOKEN_URL", "https://ato.example/oauth/token");
  const clientId = readEnv("ATO_CLIENT_ID", "sandbox-client");
  const clientSecret = readEnv("ATO_CLIENT_SECRET", "sandbox-secret");
  const scope = readEnv("ATO_SCOPE", "bas stp");
  const baseUrl = readEnv("ATO_BASE_URL", "https://ato.example/api/v1");

  const oauth = new OAuth2Client({
    tokenUrl,
    clientId,
    clientSecret,
    scope,
  });

  return new AtoClient({ baseUrl, oauth });
}

async function appendAudit(entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const previous = await prisma.auditLog.findFirst({
    where: { orgId: entry.orgId },
    orderBy: { chainSeq: "desc" },
  });

  const createdAt = new Date();
  const prevHash = previous?.hash ?? null;
  const hashPayload = JSON.stringify({
    orgId: entry.orgId,
    actorId: entry.actorId,
    action: entry.action,
    metadata: entry.metadata,
    createdAt: createdAt.toISOString(),
    prevHash,
  });
  const hash = createHash("sha256").update(hashPayload).digest("hex");
  const signaturePayload = JSON.stringify({
    hash,
    prevSignature: previous?.signature ?? null,
  });
  const signature = createHash("sha256").update(signaturePayload).digest("hex");

  await prisma.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      metadata: entry.metadata,
      createdAt,
      prevHash,
      hash,
      signature,
    },
  });
}

async function buildBasPayload(orgId: string, amount: Prisma.Decimal) {
  const now = new Date();
  const periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [gstTotals, payrollTotals] = await Promise.all([
    prisma.gstTransaction.aggregate({
      where: { orgId, txDate: { gte: periodStart, lte: now } },
      _sum: { gstCents: true, netCents: true },
    }),
    prisma.payrollItem.aggregate({
      where: { orgId },
      _sum: { paygwCents: true },
    }),
  ]);

  const gstCollected = Number(gstTotals._sum?.gstCents ?? 0n);
  const gstPaid = Number(gstTotals._sum?.netCents ?? 0n);
  const paygwWithheld = Number(payrollTotals._sum?.paygwCents ?? 0n);

  return {
    orgId,
    period: {
      start: periodStart.toISOString(),
      end: now.toISOString(),
    },
    gstCollectedCents: gstCollected,
    gstPaidCents: gstPaid,
    paygwWithheldCents: paygwWithheld,
    declaration: "I declare the information to be true and correct",
    amount,
  };
}

function toNumber(decimal: Prisma.Decimal): number {
  return Number(decimal.toString());
}

function decimalToCents(decimal: Prisma.Decimal): number {
  return Math.round(Number(decimal.toString()) * 100);
}

export async function processScheduledBasRemittances(): Promise<void> {
  const client = createAtoClientFromEnv();
  const dueRemittances = await prisma.scheduledRemittance.findMany({
    where: {
      status: "QUEUED",
      purpose: "bas_remittance",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    take: 25,
  });

  for (const remittance of dueRemittances) {
    try {
      const basPayload = await buildBasPayload(remittance.orgId, remittance.amount);
      const submission = await client.submitBas({
        orgId: basPayload.orgId,
        period: basPayload.period,
        gstCollectedCents: basPayload.gstCollectedCents,
        gstPaidCents: basPayload.gstPaidCents,
        paygwWithheldCents: basPayload.paygwWithheldCents,
        declaration: basPayload.declaration,
      });

      const payment = await client.scheduleBasPayment({
        orgId: remittance.orgId,
        amountCents: Math.round(toNumber(remittance.amount) * 100),
        dueDate: new Date().toISOString(),
        reference: submission.reference,
      });

      await prisma.scheduledRemittance.update({
        where: { id: remittance.id },
        data: {
          status: "DISPATCHED",
          dispatchedAt: new Date(),
          settlementRef: payment.scheduleId,
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      await appendAudit({
        orgId: remittance.orgId,
        actorId: SYSTEM_ACTOR,
        action: "bas.remittance.dispatch",
        metadata: {
          remittanceId: remittance.id,
          submissionReference: submission.reference,
          scheduleId: payment.scheduleId,
          amount: toNumber(remittance.amount),
        },
      });
    } catch (error) {
      const attempts = remittance.attempts + 1;
      await prisma.scheduledRemittance.update({
        where: { id: remittance.id },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          status: attempts >= 3 ? "FAILED" : "QUEUED",
        },
      });
      await appendAudit({
        orgId: remittance.orgId,
        actorId: SYSTEM_ACTOR,
        action: "bas.remittance.error",
        metadata: {
          remittanceId: remittance.id,
          error: error instanceof Error ? error.message : String(error),
          attempts,
        },
      });
    }
  }
}

export async function queueOutstandingStpReports(): Promise<void> {
  const committedRuns = await prisma.payRun.findMany({
    where: { status: "committed" },
    include: { payslips: true },
  });

  for (const run of committedRuns) {
    const existing = await prisma.scheduledRemittance.findFirst({
      where: {
        purpose: "stp_report",
        referenceType: "pay_run",
        referenceId: run.id,
      },
    });

    if (existing) {
      continue;
    }

    await prisma.scheduledRemittance.create({
      data: {
        orgId: run.orgId,
        amount: new Prisma.Decimal(0),
        purpose: "stp_report",
        channel: "api",
        status: "QUEUED",
        scheduledFor: run.paymentDate,
        referenceType: "pay_run",
        referenceId: run.id,
      },
    });
  }
}

export async function dispatchQueuedStpReports(): Promise<void> {
  const client = createAtoClientFromEnv();
  const stpQueue = await prisma.scheduledRemittance.findMany({
    where: {
      status: "QUEUED",
      purpose: "stp_report",
      scheduledFor: { lte: new Date() },
    },
    take: 25,
  });

  for (const job of stpQueue) {
    if (!job.referenceId) {
      await prisma.scheduledRemittance.update({
        where: { id: job.id },
        data: { status: "FAILED", lastAttemptAt: new Date() },
      });
      continue;
    }

    const run = await prisma.payRun.findUnique({
      where: { id: job.referenceId },
      include: {
        payslips: true,
      },
    });

    if (!run) {
      await prisma.scheduledRemittance.update({
        where: { id: job.id },
        data: { status: "FAILED", lastAttemptAt: new Date() },
      });
      continue;
    }

    try {
      const stpPayload = {
        orgId: run.orgId,
        payRunId: run.id,
        lodgementDate: new Date().toISOString(),
        employees: run.payslips.map((slip) => ({
          employeeId: slip.employeeId,
          grossCents: decimalToCents(slip.grossPay as Prisma.Decimal),
          paygwCents: decimalToCents(slip.paygWithheld as Prisma.Decimal),
          superCents: decimalToCents(slip.superAccrued as Prisma.Decimal),
        })),
      };

      const result = await client.submitStpReport(stpPayload);

      await prisma.scheduledRemittance.update({
        where: { id: job.id },
        data: {
          status: "DISPATCHED",
          dispatchedAt: new Date(),
          settlementRef: result.receipt,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });

      await appendAudit({
        orgId: run.orgId,
        actorId: SYSTEM_ACTOR,
        action: "stp.report.dispatched",
        metadata: {
          payRunId: run.id,
          receipt: result.receipt,
          status: result.status,
        },
      });
    } catch (error) {
      const attempts = job.attempts + 1;
      await prisma.scheduledRemittance.update({
        where: { id: job.id },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          status: attempts >= 3 ? "FAILED" : "QUEUED",
        },
      });

      await appendAudit({
        orgId: run.orgId,
        actorId: SYSTEM_ACTOR,
        action: "stp.report.error",
        metadata: {
          payRunId: run.id,
          error: error instanceof Error ? error.message : String(error),
          attempts,
        },
      });
    }
  }
}
