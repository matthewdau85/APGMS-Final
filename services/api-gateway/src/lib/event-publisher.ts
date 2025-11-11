import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

import type { EventBus, BusEnvelope } from "@apgms/shared/messaging/event-bus.js";

import { config } from "../config.js";

export interface PublishEventOptions<TPayload> {
  readonly orgId: string;
  readonly eventType: string;
  readonly payload: TPayload;
  readonly request?: FastifyRequest;
  readonly schemaVersion?: string;
  readonly key?: string;
  readonly dedupeId?: string;
}

export async function publishComplianceEvent<TPayload>(
  app: FastifyInstance,
  options: PublishEventOptions<TPayload>,
): Promise<void> {
  const providers = (app as any).providers ?? {};
  const bus: EventBus | null = providers.eventBus ?? null;

  if (!bus) {
    app.log.warn(
      {
        eventType: options.eventType,
        orgId: options.orgId,
      },
      "compliance_event_bus_unavailable",
    );
    return;
  }

  const now = new Date();
  const envelope: BusEnvelope<TPayload> = {
    id: randomUUID(),
    orgId: options.orgId,
    eventType: `compliance.${options.eventType}`,
    key: options.key ?? options.orgId,
    ts: now.toISOString(),
    schemaVersion: options.schemaVersion ?? "v1",
    source: "api-gateway",
    dedupeId: options.dedupeId ?? randomUUID(),
    traceId: resolveTraceId(options.request),
    payload: options.payload,
  };

  const subjectPrefix = config.nats?.subjectPrefix ?? "apgms";
  const subject = `${subjectPrefix}.compliance.${options.eventType}`;

  try {
    await bus.publish(subject, envelope);
  } catch (error) {
    app.log.error({ err: error, subject }, "publish_compliance_event_failed");
    throw error;
  }
}

function resolveTraceId(request?: FastifyRequest): string | undefined {
  if (!request) return undefined;
  const headerTrace = request.headers?.traceparent;
  if (typeof headerTrace === "string" && headerTrace.length > 0) {
    return headerTrace;
  }

  const bindings = typeof request.log?.bindings === "function" ? request.log.bindings() : null;
  const bindingTrace = bindings && typeof bindings.traceId === "string" ? bindings.traceId : undefined;
  return bindingTrace ?? undefined;
}
