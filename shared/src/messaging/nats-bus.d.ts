import type { BusEnvelope, EventBus } from "./event-bus.js";
export interface NatsBusOptions {
    url: string;
    stream: string;
    subjectPrefix: string;
    connectionName?: string;
}
export declare class NatsBus implements EventBus {
    private readonly connection;
    private readonly jetStream;
    private readonly jetStreamManager;
    private readonly stream;
    private readonly prefix;
    private constructor();
    static connect(options: NatsBusOptions): Promise<NatsBus>;
    publish<T>(subject: string, msg: BusEnvelope<T>): Promise<void>;
    subscribe(subject: string, durable: string, onMsg: (message: BusEnvelope) => Promise<void>): Promise<() => Promise<void>>;
    ping(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=nats-bus.d.ts.map