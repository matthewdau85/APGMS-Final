import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@apgms/shared/db.js";

import {
  AtoBasClient,
  AtoStpClient,
  type HttpClientOptions,
} from "../clients/ato/index.js";

const SYSTEM_ACTOR = "ato-filer";
const MAX_STP_ATTEMPTS = 3;
const MAX_BAS_ATTEMPTS = 3;

class EscrowError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "EscrowError";
  }
}

export async function runAtoFilingQueue(): Promise<void> {
  const stpClient = new AtoStpClient(buildClientOptions("ATO_STP", "https://api.ato.local/stp"));
  const basClient = new AtoBasClient(buildClientOptions("ATO_BAS", "https://api.ato.local/bas"));

  await processStpQueue(stpClient);
  await processBasQueue(basClient);
}

async function processStpQueue(client: AtoStpClient): Promise<void> {
  const now = new Date();
  const candidates = await prisma.payRun.findMany({
    where: {
      status: "committed",
      stpStatus: { in: ["PENDING", "RETRY"] },
      stpReleaseAt: { lte: now },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  for (const payRun of candidates) {
    try {
      await ensurePayrollEscrow(payRun.orgId, payRun.id);
      const submission = await client.submit({
        payRunId: payRun.id,
        lodgementReference: `STP-${payRun.id}`,
        payload: { payRunId: payRun.id },
      });

      await prisma.payRun.update({
        where: { id: payRun.id },
        data: {
          stpStatus: "FILED",
          stpSubmissionId: submission.submissionId,
          stpSubmittedAt: submission.receivedAt
            ? new Date(submission.receivedAt)
            : new Date(),
          stpAttempts: { increment: 1 },
          stpLastAttemptAt: new Date(),
        },
      });

      await appendAuditLog(payRun.orgId, "ato.stp.lodged", {
        payRunId: payRun.id,
        submissionId: submission.submissionId,
      });
    } catch (error) {
      await handleStpError(payRun.id, error);
    }
  }
}

async function processBasQueue(client: AtoBasClient): Promise<void> {
  const now = new Date();
  const periods = await prisma.basPeriod.findMany({
    where: {
      readyAt: { not: null, lte: now },
      releasedAt: { not: null, lte: now },
      lodgedAt: null,
    },
    orderBy: { start: "asc" },
    take: 10,
  });

  for (const period of periods) {
    try {
      await ensureBasEscrow(period);

      const response = await client.lodge({
        basId: period.id,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        paygw: Number(period.paygwRequired),
        gst: Number(period.gstRequired),
        declaration: {
          signer: "Automation",
          position: "APGMS Filer",
        },
      });

      await prisma.basPeriod.update({
        where: { id: period.id },
        data: {
          status: "lodged",
          lodgedAt: response.lodgedAt ? new Date(response.lodgedAt) : new Date(),
          lodgementAttempts: { increment: 1 },
          lodgementLastAttemptAt: new Date(),
        },
      });

      await appendAuditLog(period.orgId, "ato.bas.lodged", {
        basId: period.id,
        receiptReference: response.receiptReference,
      });
    } catch (error) {
      await handleBasError(period.id, error);
    }
  }
}

async function handleStpError(payRunId: string, error: unknown): Promise<void> {
  const payload: {
    stpStatus: string;
    stpAttempts?: { increment: number };
  } = {
    stpStatus: "RETRY",
    stpAttempts: { increment: 1 },
  };

  let auditMessage: Record<string, unknown> = {};

  if (error instanceof EscrowError) {
    payload.stpStatus = error.code.includes("violation")
      ? "ESCROW_BLOCKED"
      : "ESCROW_DEFICIT";
    auditMessage = { payRunId, reason: error.code };
  } else if (error instanceof Error) {
    auditMessage = { payRunId, reason: error.message };
  }

  const record = await prisma.payRun.update({
    where: { id: payRunId },
    data: {
      ...payload,
      stpLastAttemptAt: new Date(),
    },
  });

  if (record.stpAttempts >= MAX_STP_ATTEMPTS) {
    await prisma.payRun.update({
      where: { id: payRunId },
      data: { stpStatus: "FAILED" },
    });
  }

  await appendAuditLog(record.orgId, "ato.stp.failed", auditMessage);
}

async function handleBasError(basId: string, error: unknown): Promise<void> {
  const period = await prisma.basPeriod.update({
    where: { id: basId },
    data: {
      lodgementAttempts: { increment: 1 },
      lodgementLastAttemptAt: new Date(),
      status: error instanceof EscrowError ? "escrow_blocked" : "error",
    },
  });

  if (period.lodgementAttempts >= MAX_BAS_ATTEMPTS && period.status !== "lodged") {
    await prisma.basPeriod.update({
      where: { id: basId },
      data: { status: "failed" },
    });
  }

  await appendAuditLog(period.orgId, "ato.bas.failed", {
    basId,
    reason: error instanceof Error ? error.message : "unknown",
  });
}

async function ensurePayrollEscrow(orgId: string, payRunId: string): Promise<void> {
  await assertNoOpenViolations(orgId);

  const account = await prisma.designatedAccount.findFirst({
    where: {
      orgId,
      type: { equals: "PAYGW", mode: "insensitive" },
    },
  });

  if (!account) {
    throw new EscrowError("missing_paygw_designated", "PAYGW designated account missing");
  }

  const balance = Number(account.balance ?? new Prisma.Decimal(0));
  const aggregate = await prisma.payslip.aggregate({
    where: { payRunId },
    _sum: { paygWithheld: true },
  });

  const required = Number(aggregate._sum.paygWithheld ?? new Prisma.Decimal(0));
  if (balance + 0.0001 < required) {
    throw new EscrowError("insufficient_paygw", "PAYGW escrow balance below required amount");
  }
}

async function ensureBasEscrow(period: {
  id: string;
  orgId: string;
  paygwRequired: Prisma.Decimal;
  gstRequired: Prisma.Decimal;
} & Record<string, any>): Promise<void> {
  await assertNoOpenViolations(period.orgId);

  const accounts = await prisma.designatedAccount.findMany({
    where: { orgId: period.orgId },
  });

  const paygwAccount = accounts.find((account) => account.type.toUpperCase() === "PAYGW");
  const gstAccount = accounts.find((account) => account.type.toUpperCase() === "GST");

  if (!paygwAccount || !gstAccount) {
    throw new EscrowError("missing_designated_accounts", "PAYGW or GST designated accounts missing");
  }

  const paygwBalance = Number(paygwAccount.balance ?? new Prisma.Decimal(0));
  const gstBalance = Number(gstAccount.balance ?? new Prisma.Decimal(0));
  const requiredPaygw = Number(period.paygwRequired);
  const requiredGst = Number(period.gstRequired);

  if (paygwBalance + 0.0001 < requiredPaygw) {
    throw new EscrowError("insufficient_paygw", "PAYGW escrow balance below BAS requirement");
  }

  if (gstBalance + 0.0001 < requiredGst) {
    throw new EscrowError("insufficient_gst", "GST escrow balance below BAS requirement");
  }

  await prisma.basPeriod.update({
    where: { id: period.id },
    data: { escrowVerifiedAt: new Date() },
  });
}

async function assertNoOpenViolations(orgId: string): Promise<void> {
  const violation = await prisma.designatedViolationFlag.findFirst({
    where: {
      orgId,
      status: "OPEN",
    },
  });

  if (violation) {
    throw new EscrowError("violation_open", "Designated account violation flag is unresolved");
  }
}

async function appendAuditLog(
  orgId: string,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const previous = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  const createdAt = new Date();
  const prevHash = previous?.hash ?? null;
  const payload = JSON.stringify({
    orgId,
    actorId: SYSTEM_ACTOR,
    action,
    metadata,
    createdAt: createdAt.toISOString(),
    prevHash,
  });

  const hash = createHash("sha256").update(payload).digest("hex");

  const entry = await prisma.auditLog.create({
    data: {
      orgId,
      actorId: SYSTEM_ACTOR,
      action,
      metadata,
      createdAt,
      hash,
      prevHash,
    },
  });

  await prisma.auditLogSeal.create({
    data: {
      auditLogId: entry.id,
      sha256: hash,
      sealedBy: SYSTEM_ACTOR,
    },
  });
}

function buildClientOptions(prefix: string, fallbackBase: string): HttpClientOptions {
  const baseUrl = process.env[`${prefix}_BASE_URL`] ?? fallbackBase;
  const tokenUrl = process.env[`${prefix}_TOKEN_URL`] ?? `${baseUrl}/oauth/token`;
  const clientId = process.env[`${prefix}_CLIENT_ID`] ?? "local-client";
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`] ?? "local-secret";
  const scope = process.env[`${prefix}_SCOPE`];
  const audience = process.env[`${prefix}_AUDIENCE`];

  return {
    baseUrl,
    oauth: {
      tokenUrl,
      clientId,
      clientSecret,
      scope: scope || undefined,
      audience: audience || undefined,
    },
    userAgent: "APGMS-ATO-Filer/1.0",
  };
}
