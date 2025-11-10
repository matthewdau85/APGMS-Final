import { Prisma } from "@prisma/client";
import { prisma } from "@apgms/shared/db.js";
import {
  AtoBasClient,
  AtoStpClient,
  type BasSubmissionPayload,
  type StpSubmissionPayload,
} from "@apgms/ato-client";

const ATO_BASE_URL = process.env.ATO_API_BASE_URL ?? "https://sandbox.ato.gov.au";
const ATO_TOKEN_URL = process.env.ATO_OAUTH_TOKEN_URL ?? "https://sandbox.ato.gov.au/oauth/token";
const ATO_CLIENT_ID = process.env.ATO_CLIENT_ID ?? "sandbox-client";
const ATO_CLIENT_SECRET = process.env.ATO_CLIENT_SECRET ?? "sandbox-secret";

function createStpClient(): AtoStpClient {
  return new AtoStpClient(ATO_BASE_URL, {
    tokenEndpoint: ATO_TOKEN_URL,
    clientId: ATO_CLIENT_ID,
    clientSecret: ATO_CLIENT_SECRET,
    scopes: ["stp.submit"],
  });
}

function createBasClient(): AtoBasClient {
  return new AtoBasClient(ATO_BASE_URL, {
    tokenEndpoint: ATO_TOKEN_URL,
    clientId: ATO_CLIENT_ID,
    clientSecret: ATO_CLIENT_SECRET,
    scopes: ["bas.submit"],
  });
}

async function buildStpPayload(payRunId: string): Promise<StpSubmissionPayload | null> {
  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payslips: true,
    },
  });

  if (!payRun) {
    return null;
  }

  const employees = payRun.payslips.map((slip) => ({
    identifier: slip.employeeId,
    grossCents: Number(new Prisma.Decimal(slip.grossPay).mul(100)),
    paygWithheldCents: Number(new Prisma.Decimal(slip.paygWithheld).mul(100)),
    superannuationCents: Number(new Prisma.Decimal(slip.superAccrued).mul(100)),
  }));

  return {
    payRunId: payRun.id,
    periodStart: payRun.periodStart.toISOString(),
    periodEnd: payRun.periodEnd.toISOString(),
    paymentDate: payRun.paymentDate.toISOString(),
    softwareId: process.env.ATO_SOFTWARE_ID ?? "apgms-ledger", 
    employees,
  };
}

async function buildBasPayload(periodId: string): Promise<BasSubmissionPayload | null> {
  const period = await prisma.basPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    return null;
  }

  const gstTotals = await prisma.gstTransaction.aggregate({
    _sum: { gstCents: true, netCents: true },
    where: {
      orgId: period.orgId,
      txDate: {
        gte: period.start,
        lt: period.end,
      },
    },
  });

  const payrollTotals = await prisma.payrollItem.aggregate({
    _sum: { paygwCents: true },
    where: {
      orgId: period.orgId,
      payPeriodStart: { gte: period.start },
      payPeriodEnd: { lt: period.end },
    },
  });

  return {
    periodId: period.id,
    from: period.start.toISOString(),
    to: period.end.toISOString(),
    gstPayableCents: Number(gstTotals._sum.gstCents ?? 0),
    gstReceivableCents: Number(gstTotals._sum.netCents ?? 0),
    paygwWithheldCents: Number(payrollTotals._sum.paygwCents ?? 0),
    lodgementReference: period.atoLodgementReference ?? undefined,
  };
}

export async function runScheduledAtoSubmissions(): Promise<void> {
  const stpClient = createStpClient();
  const basClient = createBasClient();

  const duePayRuns = await prisma.payRun.findMany({
    where: {
      status: "committed",
      paymentDate: { lte: new Date() },
      stpSubmittedAt: null,
    },
    select: { id: true },
  });

  for (const payRun of duePayRuns) {
    const claimed = await prisma.payRun.updateMany({
      where: {
        id: payRun.id,
        stpSubmittedAt: null,
        NOT: { stpStatus: "submitting" },
      },
      data: { stpStatus: "submitting" },
    });

    if (claimed.count === 0) {
      continue;
    }

    const payload = await buildStpPayload(payRun.id);
    if (!payload) {
      await prisma.payRun.update({
        where: { id: payRun.id },
        data: { stpStatus: "errored" },
      });
      console.error("Failed to build STP payload", { payRunId: payRun.id });
      continue;
    }

    try {
      const response = await stpClient.submit(payload);
      await prisma.payRun.update({
        where: { id: payRun.id },
        data: {
          stpStatus: response.status,
          stpSubmittedAt: new Date(response.receivedAt),
          stpLodgementId: response.lodgementId,
        },
      });
    } catch (error) {
      await prisma.payRun.update({
        where: { id: payRun.id },
        data: {
          stpStatus: "errored",
        },
      });
      console.error("Failed to submit STP", { payRunId: payRun.id, error });
    }
  }

  const dueBasPeriods = await prisma.basPeriod.findMany({
    where: {
      readyAt: { not: null, lte: new Date() },
      lodgedAt: null,
    },
    select: { id: true },
  });

  for (const period of dueBasPeriods) {
    const claimed = await prisma.basPeriod.updateMany({
      where: {
        id: period.id,
        lodgedAt: null,
        NOT: { atoStatus: "submitting" },
      },
      data: { atoStatus: "submitting" },
    });

    if (claimed.count === 0) {
      continue;
    }

    const payload = await buildBasPayload(period.id);
    if (!payload) {
      await prisma.basPeriod.update({
        where: { id: period.id },
        data: { atoStatus: "errored" },
      });
      console.error("Failed to build BAS payload", { periodId: period.id });
      continue;
    }

    try {
      const response = await basClient.submit(payload);
      await prisma.basPeriod.update({
        where: { id: period.id },
        data: {
          atoStatus: response.status,
          atoLodgementReference: response.lodgementReference,
          lodgedAt: new Date(response.receivedAt),
        },
      });
    } catch (error) {
      await prisma.basPeriod.update({
        where: { id: period.id },
        data: {
          atoStatus: "errored",
        },
      });
      console.error("Failed to submit BAS", { periodId: period.id, error });
    }
  }
}
