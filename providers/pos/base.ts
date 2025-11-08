import { Prisma, type PrismaClient } from "@prisma/client";

import { AppError } from "@apgms/shared";

import type {
  IngestPosResult,
  NormalizedPosEvent,
  PosProvider,
  PosProviderContext,
  PosProviderId,
} from "./types.js";

export abstract class BasePosProvider implements PosProvider {
  readonly id: PosProviderId;

  protected constructor(id: PosProviderId) {
    this.id = id;
  }

  protected abstract normalize(payload: unknown): NormalizedPosEvent[];

  async ingestGstEvents(
    context: PosProviderContext,
    payload: unknown,
  ): Promise<IngestPosResult> {
    const events = this.normalize(payload);

    if (!Array.isArray(events) || events.length === 0) {
      throw new AppError(422, "pos_payload_empty", "POS payload did not include any GST events");
    }

    let inserted = 0;
    let updated = 0;
    let totalNet = 0;
    let totalSales = 0;

    await context.prisma.$transaction(async (tx) => {
      for (const event of events) {
        totalNet += event.netGstOwed;
        totalSales += event.taxableSales;

        const basCycleId = await resolveBasCycleId(tx, context.orgId, event.occurredAt);

        const existing = await tx.posGstEvent.findUnique({
          where: {
            orgId_providerId_eventRef: {
              orgId: context.orgId,
              providerId: this.id,
              eventRef: event.eventRef,
            },
          },
        });

        const data = {
          orgId: context.orgId,
          providerId: this.id,
          eventRef: event.eventRef,
          occurredAt: event.occurredAt,
          taxableSales: new Prisma.Decimal(event.taxableSales),
          gstCollected: new Prisma.Decimal(event.gstCollected),
          inputTaxCredits: new Prisma.Decimal(event.inputTaxCredits),
          netGstOwed: new Prisma.Decimal(event.netGstOwed),
          source: event.source,
          metadata: event.metadata ?? Prisma.JsonNull,
          basCycleId,
          ingestedAt: new Date(),
        } satisfies Prisma.PosGstEventUncheckedCreateInput;

        if (existing) {
          await tx.posGstEvent.update({
            where: { id: existing.id },
            data,
          });
          updated += 1;
        } else {
          await tx.posGstEvent.create({ data });
          inserted += 1;
        }
      }
    });

    if (context.auditLogger) {
      await context.auditLogger({
        orgId: context.orgId,
        actorId: context.actorId,
        action: "pos.ingest",
        metadata: {
          providerId: this.id,
          inserted,
          updated,
          events: events.length,
          totals: {
            netGst: Number(totalNet.toFixed(2)),
            taxableSales: Number(totalSales.toFixed(2)),
          },
        },
      });
    }

    return {
      inserted,
      updated,
      events: events.length,
      totals: {
        netGst: Number(totalNet.toFixed(2)),
        taxableSales: Number(totalSales.toFixed(2)),
      },
    };
  }
}

async function resolveBasCycleId(
  prisma: Pick<PrismaClient, "basCycle">,
  orgId: string,
  occurredAt: Date,
): Promise<string | null> {
  const cycle = await prisma.basCycle.findFirst({
    where: {
      orgId,
      periodStart: { lte: occurredAt },
      periodEnd: { gte: occurredAt },
    },
    orderBy: { periodEnd: "desc" },
  });

  return cycle?.id ?? null;
}
