import { EventEmitter } from "node:events";
export class InMemoryEventBus {
    constructor() {
        this.emitter = new EventEmitter({ captureRejections: true });
    }
    async publish(subject, msg) {
        this.emitter.emit(subject, msg);
    }
    async subscribe(subject, durable, onMsg) {
        void durable; // durable names not needed for in-memory bus
        const handler = async (msg) => {
            await onMsg(msg);
        };
        this.emitter.on(subject, handler);
        return async () => {
            this.emitter.off(subject, handler);
        };
    }
}
//# sourceMappingURL=in-memory-bus.js.map