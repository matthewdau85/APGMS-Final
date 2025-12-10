import type { BusEnvelope, EventBus } from "./event-bus.js";
export declare class InMemoryEventBus implements EventBus {
    private readonly emitter;
    publish<T>(subject: string, msg: BusEnvelope<T>): Promise<void>;
    subscribe(subject: string, durable: string, onMsg: (message: BusEnvelope) => Promise<void>): Promise<() => Promise<void>>;
}
//# sourceMappingURL=in-memory-bus.d.ts.map