import type { FastifyBaseLogger } from "fastify";

import { startNatsIngestionConsumer } from "@apgms/ingestion-nats";
import type { BusEnvelope, NatsBus } from "@apgms/shared";
import { NatsBus as SharedNatsBus } from "@apgms/shared";
import { recordPayrollContribution } from "@apgms/shared/ledger/ingest";

import { prisma } from "../db.js";
import { config } from "../config.js";

export type PayrollIngestionHandle = {
  stop: () => Promise<void>;
};

type PayrollPayload = {
  payrollId: string;
  paygwCents: number;
  gstCents?: number;
  paygiCents?: number;
};

export async function startPayrollIngestion(logger: FastifyBaseLogger): Promise<PayrollIngestionHandle | null> {
  const ingestionConfig = config.ingestion;
  if (!ingestionConfig?.payrollSubject || !ingestionConfig.nats) {
    return null;
  }

  const bus = await SharedNatsBus.connect({
    url: ingestionConfig.nats.url,
    stream: ingestionConfig.nats.stream,
    subjectPrefix: ingestionConfig.nats.subjectPrefix,
  });

  const consumer = await startNatsIngestionConsumer<PayrollPayload>({
    bus: bus as unknown as NatsBus,
    subject: ingestionConfig.payrollSubject,
    durableName: ingestionConfig.durableName,
    handler: async (message) => handlePayrollMessage(message, logger),
    onError: (error, envelope) => {
      logger.error({ err: error, envelope }, "payroll_ingestion_failed");
    },
  });

  logger.info({ subject: ingestionConfig.payrollSubject }, "payroll_ingestion_started");

  return {
    stop: async () => {
      logger.info("payroll_ingestion_stopping");
      await consumer.stop();
      await bus.close();
    },
  };
}

async function handlePayrollMessage(message: BusEnvelope<PayrollPayload>, logger: FastifyBaseLogger) {
  const amountDollars = (message.payload.paygwCents ?? 0) / 100;
  if (amountDollars <= 0) {
    logger.warn({ envelopeId: message.id }, "payroll_ingestion_skipped");
    return;
  }

  await recordPayrollContribution({
    prisma,
    orgId: message.orgId,
    amount: amountDollars,
    actorId: "nats-ingestion",
    payload: message.payload,
    idempotencyKey: message.dedupeId,
  });
}
