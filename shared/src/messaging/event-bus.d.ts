export type BusEnvelope<T = unknown> = {
    id: string;
    orgId: string;
    eventType: string;
    key: string;
    ts: string;
    schemaVersion: string;
    source: string;
    dedupeId: string;
    traceId?: string;
    payload: T;
};
export interface EventBus {
    publish<T>(subject: string, msg: BusEnvelope<T>): Promise<void>;
    subscribe(subject: string, durable: string, onMsg: (message: BusEnvelope) => Promise<void>): Promise<() => Promise<void>>;
}
//# sourceMappingURL=event-bus.d.ts.map