import { Prisma, type PrismaClient } from "@prisma/client";

import { AppError } from "@apgms/shared";

import type {
  IngestStpResult,
  NormalizedStpSummary,
  StpProvider,
  StpProviderContext,
  StpProviderId,
} from "./types.js";

export abstract class BaseStpProvider implements StpProvider {
  readonly id: StpProviderId;

  protected constructor(id: StpProviderId) {
    this.id = id;
  }

  protected abstract normalize(payload: unknown): NormalizedStpSummary[];

  async ingestPayrollSummaries(
    context: StpProviderContext,
    payload: unknown,
  ): Promise<IngestStpResult> {
    const summaries = this.normalize(payload);

    if (!Array.isArray(summaries) || summaries.length === 0) {
      throw new AppError(422, "stp_payload_empty", "STP payload did not include any payroll summaries");
    }

    let inserted = 0;
    let updated = 0;
    let totalPaygw = 0;
    let totalGross = 0;

    await context.prisma.$transaction(async (tx) => {
      for (const summary of summaries) {
        totalPaygw += summary.paygwWithheld;
        totalGross += summary.grossWages;

        const basCycleId = await resolveBasCycleId(tx, context.orgId, summary.paymentDate);

        const existing = await tx.stpPayrollSummary.findUnique({
          where: {
            orgId_providerId_providerRunId: {
              orgId: context.orgId,
              providerId: this.id,
              providerRunId: summary.providerRunId,
            },
          },
        });

        const data = {
          orgId: context.orgId,
          providerId: this.id,
          providerRunId: summary.providerRunId,
          periodStart: summary.periodStart,
          periodEnd: summary.periodEnd,
          paymentDate: summary.paymentDate,
          grossWages: new Prisma.Decimal(summary.grossWages),
          paygwWithheld: new Prisma.Decimal(summary.paygwWithheld),
          superAccrued: new Prisma.Decimal(summary.superAccrued),
          employeeCount: summary.employeeCount,
          source: summary.source,
          metadata: summary.metadata ?? Prisma.JsonNull,
          basCycleId,
          ingestedAt: new Date(),
        } satisfies Prisma.StpPayrollSummaryUncheckedCreateInput;

        if (existing) {
          await tx.stpPayrollSummary.update({
            where: { id: existing.id },
            data,
          });
          updated += 1;
        } else {
          await tx.stpPayrollSummary.create({ data });
          inserted += 1;
        }
      }
    });

    if (context.auditLogger) {
      await context.auditLogger({
        orgId: context.orgId,
        actorId: context.actorId,
        action: "stp.ingest",
        metadata: {
          providerId: this.id,
          inserted,
          updated,
          runs: summaries.length,
          totals: {
            paygw: Number(totalPaygw.toFixed(2)),
            gross: Number(totalGross.toFixed(2)),
          },
        },
      });
    }

    return {
      inserted,
      updated,
      runs: summaries.length,
      totals: {
        paygw: Number(totalPaygw.toFixed(2)),
        gross: Number(totalGross.toFixed(2)),
      },
    };
  }
}

async function resolveBasCycleId(
  prisma: Pick<PrismaClient, "basCycle">,
  orgId: string,
  paymentDate: Date,
): Promise<string | null> {
  const cycle = await prisma.basCycle.findFirst({
    where: {
      orgId,
      periodStart: { lte: paymentDate },
      periodEnd: { gte: paymentDate },
    },
    orderBy: { periodEnd: "desc" },
  });

  return cycle?.id ?? null;
}
