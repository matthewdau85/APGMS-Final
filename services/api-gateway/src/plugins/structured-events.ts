import { randomUUID } from "node:crypto";

import fp from "fastify-plugin";
import { StringCodec } from "nats";
import type { FastifyInstance, FastifyRequest } from "fastify";

const codec = StringCodec();

export type StructuredEntityType =
  | "discrepancy"
  | "fraud"
  | "remediation"
  | "payment_plan"
  | (string & {});

export interface StructuredEvent {
  id?: string;
  type: string;
  schemaVersion?: string;
  orgId: string;
  entityType: StructuredEntityType;
  entityId: string;
  occurredAt?: Date;
  payload: Record<string, unknown>;
  correlationId?: string;
  traceId?: string;
  status?: string;
  severity?: string;
  summary?: string;
  tags?: string[];
  context?: Record<string, unknown>;
  source?: string;
}

interface StructuredEnvelope {
  id: string;
  eventType: string;
  schemaVersion: string;
  source: string;
  orgId: string;
  entity: {
    type: StructuredEntityType;
    id: string;
    status?: string;
    severity?: string;
  };
  summary?: string;
  occurredAt: string;
  correlationId?: string;
  traceId?: string;
  tags: string[];
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
}

async function publishEvent(
  app: FastifyInstance,
  event: StructuredEvent,
  request?: FastifyRequest,
): Promise<void> {
  const subject = process.env.COMPLIANCE_EVENTS_SUBJECT?.trim() || "compliance.events";
  const schemaVersion = event.schemaVersion ?? "2024-11-01";
  const source = event.source ?? "api-gateway";
  const id = event.id ?? randomUUID();
  const occurredAt = event.occurredAt ?? new Date();

  const context: Record<string, unknown> = {
    ...(event.context ?? {}),
  };

  let resolvedTraceId = event.traceId;
  if (request) {
    const user = (request as FastifyRequest & { user?: Record<string, unknown> }).user;
    if (user) {
      context.user = {
        id: user.sub,
        role: user.role,
        orgId: user.orgId,
      };
    }
    resolvedTraceId =
      resolvedTraceId ?? (request.log as any)?.bindings?.()?.traceId ?? (request.headers["x-trace-id"] as string | undefined);
    if (resolvedTraceId) {
      context.traceId = resolvedTraceId;
    }
  }

  const envelope: StructuredEnvelope = {
    id,
    eventType: event.type,
    schemaVersion,
    source,
    orgId: event.orgId,
    entity: {
      type: event.entityType,
      id: event.entityId,
      status: event.status,
      severity: event.severity,
    },
    summary: event.summary,
    occurredAt: occurredAt.toISOString(),
    correlationId: event.correlationId ?? request?.id,
    traceId: resolvedTraceId,
    tags: event.tags ?? [],
    payload: event.payload,
    context,
  };

  const nats = (app as any).providers?.nats ?? null;
  if (!nats) {
    app.log.warn({ envelope }, "structured_event_dropped_no_nats");
    return;
  }

  try {
    await nats.publish(subject, codec.encode(JSON.stringify(envelope)));
  } catch (error) {
    app.log.error({ err: error, envelope }, "structured_event_publish_failed");
    throw error;
  }
}

const structuredEventsPlugin = fp(async (app: FastifyInstance) => {
  app.decorate(
    "publishStructuredEvent",
    async (event: StructuredEvent) => publishEvent(app, event),
  );

  app.decorateRequest("publishStructuredEvent", function (event: StructuredEvent) {
    return publishEvent(app, event, this as FastifyRequest);
  });
});

export default structuredEventsPlugin;
