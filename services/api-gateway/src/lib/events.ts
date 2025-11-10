import { randomUUID } from "node:crypto";

import { context, trace } from "@opentelemetry/api";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { BusEnvelope } from "@apgms/shared";

import { config } from "../config.js";
import type { Providers } from "../providers.js";

const DEFAULT_SCHEMA_VERSION = "apgms.ops.v1";

const subjectPrefix = config.nats?.subjectPrefix ?? "apgms.events";

export const operationalSubjects = {
  ledger: {
    bankLineRecorded: `${subjectPrefix}.ledger.bank-line.recorded`,
    discrepancyDetected: `${subjectPrefix}.ledger.discrepancy.detected`,
  },
  payments: {
    disbursementScheduled: `${subjectPrefix}.payments.disbursement.scheduled`,
    fraudAlertRaised: `${subjectPrefix}.payments.fraud-alert.raised`,
  },
  compliance: {
    remediationLogged: `${subjectPrefix}.compliance.remediation.logged`,
    paymentPlanAgreed: `${subjectPrefix}.compliance.payment-plan.agreed`,
  },
} as const;

export interface OperationalEventOptions<TPayload> {
  subject: string;
  eventType: string;
  orgId: string;
  key: string;
  payload: TPayload;
  dedupeId?: string;
  id?: string;
  source?: string;
  schemaVersion?: string;
}

export async function publishOperationalEvent<TPayload>(
  app: FastifyInstance,
  options: OperationalEventOptions<TPayload>,
  request?: FastifyRequest,
): Promise<void> {
  const providers = (app as FastifyInstance & { providers?: Providers }).providers;
  const bus = providers?.eventBus;

  if (!bus) {
    app.log.warn({ eventType: options.eventType }, "event_bus_unavailable");
    return;
  }

  const span = trace.getSpan(context.active());
  const traceId = span?.spanContext().traceId ?? (request as any)?.traceId;

  const envelope: BusEnvelope<TPayload> = {
    id: options.id ?? randomUUID(),
    orgId: options.orgId,
    eventType: options.eventType,
    key: options.key,
    ts: new Date().toISOString(),
    schemaVersion: options.schemaVersion ?? config.nats?.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    source: options.source ?? "services/api-gateway",
    dedupeId: options.dedupeId ?? randomUUID(),
    traceId,
    payload: options.payload,
  };

  await bus.publish(options.subject, envelope);
}
