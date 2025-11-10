import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { context, trace } from "@opentelemetry/api";
import {
  DiscardPolicy,
  RetentionPolicy,
  StorageType,
  type JetStreamManager,
  type NatsConnection,
} from "nats";

export interface PublishDomainEventOptions {
  subject: string;
  eventType: string;
  orgId: string;
  key: string;
  payload: unknown;
  schemaVersion?: string;
  dedupeId?: string;
  source?: string;
  timestamp?: Date | string;
}

const DEFAULT_SCHEMA_VERSION = "2025-03-12";
const DEFAULT_SOURCE = "services.api-gateway";

async function ensureStream(
  connection: NatsConnection,
  stream: string,
  prefix: string,
): Promise<void> {
  const manager: JetStreamManager = await connection.jetstreamManager();
  try {
    await manager.streams.info(stream);
    return;
  } catch {
    // stream is missing; create it below
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

export default fp(async (app) => {
  const nats: NatsConnection | null = (app as any).providers?.nats ?? null;
  const eventsConfig = (app as any).config?.events ?? {};
  const subjectPrefix: string = eventsConfig.subjectPrefix ?? "apgms.dev";
  const streamName: string = eventsConfig.stream ?? "APGMS";

  let streamReady: Promise<void> | null = null;
  if (nats) {
    streamReady = ensureStream(nats, streamName, subjectPrefix).catch((error) => {
      app.log.error({ err: error }, "nats_stream_init_failed");
      throw error;
    });
  }

  const publish = async (
    options: PublishDomainEventOptions,
    traceId?: string,
  ): Promise<void> => {
    if (!nats) {
      app.log.warn({ subject: options.subject }, "nats_publish_skipped_no_connection");
      return;
    }

    if (!options.subject || options.subject.trim().length === 0) {
      throw new Error("subject is required to publish a domain event");
    }

    const fullSubject = options.subject.startsWith(`${subjectPrefix}.`)
      ? options.subject
      : `${subjectPrefix}.${options.subject}`;

    const envelope = {
      id: randomUUID(),
      orgId: options.orgId,
      eventType: options.eventType,
      key: options.key,
      ts: (options.timestamp instanceof Date ? options.timestamp.toISOString() : options.timestamp) ?? new Date().toISOString(),
      schemaVersion: options.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
      source: options.source ?? DEFAULT_SOURCE,
      dedupeId: options.dedupeId ?? options.key,
      traceId,
      payload: options.payload,
    };

    try {
      if (streamReady) {
        await streamReady;
      }
      const jetstream = nats.jetstream();
      await jetstream.publish(fullSubject, Buffer.from(JSON.stringify(envelope)));
      app.log.debug({ subject: fullSubject, eventType: options.eventType }, "nats_domain_event_published");
    } catch (error) {
      app.log.error({ err: error, subject: fullSubject }, "nats_publish_failed");
      throw error;
    }
  };

  app.decorate("publishDomainEvent", async (options: PublishDomainEventOptions) => {
    const activeSpan = trace.getSpan(context.active());
    const traceId = activeSpan?.spanContext().traceId;
    await publish(options, traceId);
  });

  app.decorateRequest("publishDomainEvent", async function publishFromRequest(
    this: FastifyRequest,
    options: PublishDomainEventOptions,
  ) {
    const activeSpan = trace.getSpan(context.active());
    const traceId = activeSpan?.spanContext().traceId;
    await publish(options, traceId);
  });
});

