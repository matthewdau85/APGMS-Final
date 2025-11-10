import { randomUUID } from "node:crypto";

import type { FastifyBaseLogger } from "fastify";
import {
  DiscardPolicy,
  JetStreamClient,
  JetStreamManager,
  NatsConnection,
  RetentionPolicy,
  StorageType,
  StringCodec,
} from "nats";

const codec = StringCodec();

export interface RiskEventPublisherOptions {
  stream: string;
  subject: string;
  subjectPrefix: string;
}

export interface RiskEventContext {
  orgId: string;
  actorId?: string;
  requestId?: string;
  traceId?: string;
  dedupeId?: string;
  key?: string;
  occurredAt?: Date;
  payload: Record<string, unknown>;
  severity?: string;
}

export interface RiskEventPublisher {
  publishValidationFailure(ctx: RiskEventContext): Promise<void>;
  publishOverride(ctx: RiskEventContext): Promise<void>;
  publishBalanceDrift(ctx: RiskEventContext): Promise<void>;
}

const SCHEMA_VERSION = "2024-12-01";
const SOURCE = "services.api-gateway";

export function createRiskEventPublisher(
  connection: NatsConnection | null,
  logger: FastifyBaseLogger,
  options: RiskEventPublisherOptions,
): RiskEventPublisher {
  if (!connection) {
    const warnNoop = async (eventType: string, ctx: RiskEventContext) => {
      logger.warn(
        {
          eventType,
          orgId: ctx.orgId,
        },
        "risk_event_dropped_no_nats",
      );
    };
    return {
      publishValidationFailure: (ctx) => warnNoop("discrepancy.validation_failed", ctx),
      publishOverride: (ctx) => warnNoop("fraud.override_performed", ctx),
      publishBalanceDrift: (ctx) => warnNoop("discrepancy.balance_drift", ctx),
    };
  }

  let jetStream: JetStreamClient | null = null;
  let manager: JetStreamManager | null = null;
  const ensure = async () => {
    if (!jetStream || !manager) {
      jetStream = connection.jetstream();
      manager = await connection.jetstreamManager();
      await ensureStream(manager, options.stream, options.subjectPrefix, logger);
    }
    return jetStream!;
  };

  const publish = async (
    eventType: string,
    ctx: RiskEventContext,
  ) => {
    try {
      const client = await ensure();
      const ts = (ctx.occurredAt ?? new Date()).toISOString();
      const dedupeId = ctx.dedupeId ?? `${eventType}:${ctx.requestId ?? randomUUID()}`;
      const key = ctx.key ?? dedupeId;
      const envelope = {
        id: randomUUID(),
        orgId: ctx.orgId,
        eventType,
        key,
        ts,
        schemaVersion: SCHEMA_VERSION,
        source: SOURCE,
        dedupeId,
        traceId: ctx.traceId,
        payload: {
          ...ctx.payload,
          actorId: ctx.actorId,
          requestId: ctx.requestId,
          severity: ctx.severity,
        },
      };
      await client.publish(options.subject, codec.encode(JSON.stringify(envelope)));
    } catch (error) {
      logger.error({ err: error, eventType, orgId: ctx.orgId }, "risk_event_publish_failed");
    }
  };

  return {
    publishValidationFailure: async (ctx) =>
      publish("discrepancy.validation_failed", {
        ...ctx,
        severity: ctx.severity ?? "medium",
      }),
    publishOverride: async (ctx) =>
      publish("fraud.override_performed", {
        ...ctx,
        severity: ctx.severity ?? "high",
      }),
    publishBalanceDrift: async (ctx) =>
      publish("discrepancy.balance_drift", {
        ...ctx,
        severity: ctx.severity ?? "high",
      }),
  };
}

async function ensureStream(
  manager: JetStreamManager,
  stream: string,
  prefix: string,
  logger: FastifyBaseLogger,
): Promise<void> {
  try {
    await manager.streams.info(stream);
    return;
  } catch (error) {
    logger.info({ stream }, "creating_jetstream_stream");
  }

  await manager.streams.add({
    name: stream,
    subjects: [`${prefix}.>`],
    retention: RetentionPolicy.Limits,
    discard: DiscardPolicy.Old,
    storage: StorageType.File,
    num_replicas: 1,
  });
}
