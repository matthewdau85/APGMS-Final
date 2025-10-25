import { EventEmitter } from "node:events";

import type { BusEnvelope, EventBus } from "./event-bus.js";

export class InMemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  async publish<T>(subject: string, msg: BusEnvelope<T>): Promise<void> {
    this.emitter.emit(subject, msg);
  }

  async subscribe(
    subject: string,
    durable: string,
    onMsg: (message: BusEnvelope) => Promise<void>,
  ): Promise<() => Promise<void>> {
    void durable; // durable names not needed for in-memory bus

    const handler = async (msg: BusEnvelope) => {
      await onMsg(msg);
    };

    this.emitter.on(subject, handler);

    return async () => {
      this.emitter.off(subject, handler);
    };
  }
}

