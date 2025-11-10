import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  DiscardPolicy,
  RetentionPolicy,
  StorageType,
  headers,
  type JetStreamManager,
  type NatsConnection,
} from "nats";

import type { BusEnvelope } from "@apgms/shared";

import { config } from "../config.js";

const SCHEMA_VERSION = "apgms.compliance.v1";

type ComplianceSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ComplianceEventKind = "DISCREPANCY" | "OVERRIDE";

export interface ComplianceEventInput {
  readonly kind: ComplianceEventKind;
  readonly orgId: string;
  readonly category: string;
  readonly severity: ComplianceSeverity;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
  readonly actor?: {
    readonly type: "user" | "system" | "service";
    readonly id?: string;
    readonly role?: string;
  };
  readonly occurredAt?: Date;
  readonly request?: FastifyRequest;
  readonly source?: string;
}

interface ComplianceEventPayload {
  readonly kind: ComplianceEventKind;
  readonly category: string;
  readonly severity: ComplianceSeverity;
  readonly description?: string;
  readonly metadata: Record<string, unknown>;
  readonly actor: {
    readonly type: string;
    readonly id?: string;
    readonly role?: string;
  };
  readonly occurredAt: string;
  readonly requestContext?: {
    readonly id?: string;
    readonly method?: string;
    readonly route?: string;
    readonly ip?: string;
  };
}

let streamReady: Promise<void> | null = null;

export async function publishComplianceEvent(
  app: FastifyInstance,
  input: ComplianceEventInput,
): Promise<void> {
  const providers = (app as any).providers as { nats?: NatsConnection | null } | undefined;
  const nats = providers?.nats;
  if (!nats) {
    app.log.debug({ input }, "compliance_event_skipped_no_nats");
    return;
  }

  const subjects = config.nats?.subjects ?? {
    discrepancy: `${config.nats?.subjectPrefix ?? "apgms.dev"}.compliance.discrepancy`,
    override: `${config.nats?.subjectPrefix ?? "apgms.dev"}.compliance.override`,
  };
  const subject =
    input.kind === "OVERRIDE" ? subjects.override : subjects.discrepancy;

  const occurredAt = input.occurredAt ?? new Date();
  const actor = resolveActor(input);
  const metadata = buildMetadata(input);
  const traceId = input.request?.id ?? undefined;

  const payload: ComplianceEventPayload = {
    kind: input.kind,
    category: input.category,
    severity: input.severity,
    description: input.description,
    metadata,
    actor,
    occurredAt: occurredAt.toISOString(),
    requestContext: buildRequestContext(input.request),
  };

  const envelope: BusEnvelope<ComplianceEventPayload> = {
    id: randomUUID(),
    orgId: input.orgId,
    eventType: `compliance.${input.kind.toLowerCase()}`,
    key: `${input.orgId}:${input.category}`,
    ts: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    source: input.source ?? "api-gateway",
    dedupeId: randomUUID(),
    traceId,
    payload,
  };

  try {
    await ensureStream(nats);
    const jetStream = nats.jetstream();
    const data = Buffer.from(JSON.stringify(envelope), "utf8");
    const hdrs = headers();
    hdrs.set("apgms-eventType", envelope.eventType);
    hdrs.set("apgms-schema", envelope.schemaVersion);
    hdrs.set("apgms-source", envelope.source);
    if (traceId) {
      hdrs.set("traceparent", traceId);
    }
    await jetStream.publish(subject, data, { headers: hdrs });
  } catch (error) {
    app.log.error({ err: error }, "compliance_event_publish_failed");
  }
}

function resolveActor(input: ComplianceEventInput): ComplianceEventPayload["actor"] {
  if (input.actor) {
    return input.actor;
  }
  const user = (input.request as any)?.user as
    | { sub?: string; role?: string }
    | undefined;
  if (user?.sub) {
    return { type: "user", id: user.sub, role: user.role };
  }
  return { type: "system" };
}

function buildMetadata(input: ComplianceEventInput): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      if (value !== undefined) {
        base[key] = value;
      }
    }
  }
  const request = input.request;
  if (request) {
    base.requestId = request.id;
    base.httpMethod = request.method;
    base.route = request.routeOptions?.url ?? request.raw?.url;
  }
  return base;
}

function buildRequestContext(
  request: FastifyRequest | undefined,
): ComplianceEventPayload["requestContext"] | undefined {
  if (!request) return undefined;
  return {
    id: request.id,
    method: request.method,
    route: request.routeOptions?.url ?? request.raw?.url,
    ip: request.ip,
  };
}

async function ensureStream(connection: NatsConnection): Promise<void> {
  if (!config.nats?.stream || !config.nats?.subjectPrefix) {
    return;
  }
  if (!streamReady) {
    streamReady = (async () => {
      let manager: JetStreamManager | undefined;
      try {
        manager = await connection.jetstreamManager();
        await manager.streams.info(config.nats.stream);
      } catch (error) {
        if (!manager) {
          throw error;
        }
        await manager.streams.add({
          name: config.nats.stream,
          subjects: [`${config.nats.subjectPrefix}.>`],
          retention: RetentionPolicy.Limits,
          discard: DiscardPolicy.Old,
          storage: StorageType.File,
          num_replicas: 1,
        });
      }
    })();
  }
  try {
    await streamReady;
  } catch (error) {
    streamReady = null;
    throw error;
  }
}
