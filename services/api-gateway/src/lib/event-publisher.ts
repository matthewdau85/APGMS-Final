import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";
import { DiscardPolicy, RetentionPolicy, StorageType, StringCodec } from "nats";

import { config } from "../config.js";

const codec = StringCodec();
const DEFAULT_STREAM = "APGMS";
const DEFAULT_SUBJECT_PREFIX = "apgms.events";

let ensurePromise: Promise<void> | null = null;
let streamReady = false;

async function ensureStream(app: FastifyInstance): Promise<void> {
  if (streamReady) {
    return;
  }
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const providers = (app as any).providers as
        | { nats?: { jetstream: () => any; jetstreamManager: () => Promise<any> } | null }
        | undefined;
      const connection = providers?.nats;
      if (!connection) {
        return;
      }
      const stream = config.nats?.stream?.trim().length
        ? config.nats.stream.trim()
        : DEFAULT_STREAM;
      const prefix = config.nats?.subjectPrefix?.trim().length
        ? config.nats.subjectPrefix.trim()
        : DEFAULT_SUBJECT_PREFIX;
      const manager = await connection.jetstreamManager();
      try {
        await manager.streams.info(stream);
      } catch {
        await manager.streams.add({
          name: stream,
          subjects: [`${prefix}.>`],
          retention: RetentionPolicy.Limits,
          discard: DiscardPolicy.Old,
          storage: StorageType.File,
          num_replicas: 1,
          max_age: 14 * 24 * 60 * 60 * 1_000_000_000,
        });
      }
      streamReady = true;
    })().catch((error) => {
      app.log.error({ err: error }, "event_stream_ensure_failed");
      streamReady = false;
      ensurePromise = null;
    });
  }
  await ensurePromise;
}

function buildTraceId(request?: FastifyRequest): string | undefined {
  if (!request) {
    return undefined;
  }
  const traceparent = request.headers["traceparent"];
  if (typeof traceparent === "string" && traceparent.length > 0) {
    return traceparent;
  }
  if (typeof (request as any).id === "string") {
    return (request as any).id;
  }
  return undefined;
}

interface StructuredEventHints {
  readonly schemaVersion?: string;
  readonly dedupeKey?: string;
  readonly key?: string;
  readonly traceId?: string;
}

export async function publishStructuredEvent(
  app: FastifyInstance,
  subjectSuffix: string,
  eventType: string,
  orgId: string,
  payload: Record<string, unknown>,
  request?: FastifyRequest,
): Promise<void> {
  const providers = (app as any).providers as { nats?: any } | undefined;
  const connection = providers?.nats;
  if (!connection) {
    app.log.warn(
      { subject: subjectSuffix, eventType, orgId },
      "event_publish_skipped_no_nats",
    );
    return;
  }

  const stream = config.nats?.stream?.trim().length
    ? config.nats.stream.trim()
    : DEFAULT_STREAM;
  const prefix = config.nats?.subjectPrefix?.trim().length
    ? config.nats.subjectPrefix.trim()
    : DEFAULT_SUBJECT_PREFIX;
  const hints = payload as StructuredEventHints;
  const traceId = hints.traceId ?? buildTraceId(request);
  const key = hints.key ?? randomUUID();
  const dedupeKey = hints.dedupeKey ?? `${orgId}:${eventType}:${key}`;
  const schemaVersion = hints.schemaVersion ?? "2025-11-05";

  await ensureStream(app);

  const envelope = {
    id: randomUUID(),
    orgId,
    eventType,
    key,
    ts: new Date().toISOString(),
    schemaVersion,
    source: "api-gateway",
    dedupeId: dedupeKey,
    traceId,
    payload,
  };

  const subject = `${prefix}.${subjectSuffix}`;
  const jetStream = connection.jetstream();
  const data = codec.encode(JSON.stringify(envelope));

  try {
    await jetStream.publish(subject, data, { msgID: dedupeKey, expect: { stream } });
  } catch (error) {
    app.log.error(
      { err: error, subject, eventType, orgId },
      "event_publish_failed",
    );
  }
}
