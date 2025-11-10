import { createHash } from "node:crypto";
import { DiscardPolicy, RetentionPolicy, StorageType, StringCodec, connect, consumerOpts, headers, } from "nats";
const codec = StringCodec();
export class NatsBus {
    connection;
    jetStream;
    jetStreamManager;
    stream;
    prefix;
    constructor(connection, jetStream, jetStreamManager, stream, prefix) {
        this.connection = connection;
        this.jetStream = jetStream;
        this.jetStreamManager = jetStreamManager;
        this.stream = stream;
        this.prefix = prefix;
    }
    static async connect(options) {
        const connection = await connect({
            servers: options.url,
            name: options.connectionName ?? "apgms-nats-bus",
            token: options.token,
            user: options.username,
            pass: options.password,
        });
        const jetStream = connection.jetstream();
        const jetStreamManager = await connection.jetstreamManager();
        await ensureStream(jetStreamManager, options.stream, options.subjectPrefix);
        return new NatsBus(connection, jetStream, jetStreamManager, options.stream, options.subjectPrefix);
    }
    async publish(subject, msg) {
        const payload = codec.encode(JSON.stringify(msg));
        const hdrs = buildHeaders(msg);
        await this.jetStream.publish(subject, payload, { headers: hdrs });
    }
    async subscribe(subject, durable, onMsg) {
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
                }
                catch (error) {
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
    async ping() {
        await this.connection.flush();
    }
    async close() {
        await this.connection.drain();
    }
}
function decodeEnvelope(data) {
    const raw = codec.decode(data);
    return JSON.parse(raw);
}
function ensureHeaderString(value) {
    return value === undefined ? undefined : value;
}
function buildHeaders(msg) {
    const hdrs = headers();
    hdrs.set("apgms-eventType", msg.eventType);
    hdrs.set("apgms-schema", msg.schemaVersion);
    hdrs.set("apgms-source", msg.source);
    if (msg.traceId) {
        hdrs.set("traceparent", msg.traceId);
    }
    return hdrs;
}
async function ensureStream(jetStreamManager, stream, prefix) {
    try {
        await jetStreamManager.streams.info(stream);
        return;
    }
    catch {
        // stream missing; fall through to create
    }
    await jetStreamManager.streams.add({
        name: stream,
        subjects: [`${prefix}.>`],
        retention: RetentionPolicy.Limits,
        discard: DiscardPolicy.Old,
        storage: StorageType.File,
        num_replicas: 1,
        max_age: 14 * 24 * 60 * 60 * 1_000_000_000,
    });
}
function hashSubject(subject) {
    return createHash("sha1").update(subject).digest("hex").slice(0, 8);
}
