import { createHash } from "node:crypto";

import {
  DiscardPolicy,
  JetStreamClient,
  JetStreamManager,
  NatsConnection,
  RetentionPolicy,
  StorageType,
  StringCodec,
  connect,
  consumerOpts,
  headers,
} from "nats";

import type { BusEnvelope, EventBus } from "./event-bus.js";

export interface NatsBusOptions {
  url: string;
  stream: string;
  subjectPrefix: string;
  connectionName?: string;
}

const codec = StringCodec();

export class NatsBus implements EventBus {
  private constructor(
    private readonly connection: NatsConnection,
    private readonly jetStream: JetStreamClient,
    private readonly jetStreamManager: JetStreamManager,
    private readonly stream: string,
    private readonly prefix: string,
  ) {}

  public static async connect(options: NatsBusOptions): Promise<NatsBus> {
    const connection = await connect({
      servers: options.url,
      name: options.connectionName ?? "apgms-nats-bus",
    });

    const jetStream = connection.jetstream();
    const jetStreamManager = await connection.jetstreamManager();
    await ensureStream(jetStreamManager, options.stream, options.subjectPrefix);

    return new NatsBus(connection, jetStream, jetStreamManager, options.stream, options.subjectPrefix);
  }

  public async publish<T>(subject: string, msg: BusEnvelope<T>): Promise<void> {
    const payload = codec.encode(JSON.stringify(msg));
    const hdrs = buildHeaders(msg);

    await this.jetStream.publish(subject, payload, { headers: hdrs });
  }

  public async subscribe(
    subject: string,
    durable: string,
    onMsg: (message: BusEnvelope) => Promise<void>,
  ): Promise<() => Promise<void>> {
    const opts = consumerOpts();
    opts.ackExplicit();
    opts.durable(durable);
    opts.manualAck();
    opts.deliverGroup(durable);
    opts.queue(durable);
    opts.deliverTo(`apgms-consumer-${hashSubject(subject)}-${durable}`);

    const subscription = await this.jetStream.subscribe(subject, opts);

    (async () => {
      for await (const message of subscription) {
        try {
          const envelope = decodeEnvelope(message.data);
          await onMsg(envelope);
          message.ack();
        } catch (error) {
          message.nak();
          // eslint-disable-next-line no-console
          console.error("Failed to process NATS message", { subject, durable, error });
        }
      }
    })().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("NATS subscription closed with error", { subject, durable, error });
    });

    return async () => {
      subscription.unsubscribe();
    };
  }

  public async ping(): Promise<void> {
    await this.connection.flush();
  }

  public async close(): Promise<void> {
    await this.connection.drain();
  }
}

function decodeEnvelope(data: Uint8Array): BusEnvelope {
  const raw = codec.decode(data);
  return JSON.parse(raw) as BusEnvelope;
}

function buildHeaders<T>(msg: BusEnvelope<T>) {
  const hdrs = headers();
  hdrs.set("apgms-eventType", msg.eventType);
  hdrs.set("apgms-schema", msg.schemaVersion);
  hdrs.set("apgms-source", msg.source);
  if (msg.traceId) {
    hdrs.set("traceparent", msg.traceId);
  }
  return hdrs;
}

async function ensureStream(
  jetStreamManager: JetStreamManager,
  stream: string,
  prefix: string,
): Promise<void> {
  try {
    await jetStreamManager.streams.info(stream);
    return;
  } catch {
    // stream missing; fall through to create
  }

  await jetStreamManager.streams.add({
    name: stream,
    subjects: [`${prefix}.>`],
    retention: RetentionPolicy.Limits,
    discard: DiscardPolicy.Old,
    storage: StorageType.File,
    num_replicas: 1,
  });
}

function hashSubject(subject: string): string {
  return createHash("sha1").update(subject).digest("hex").slice(0, 8);
}

