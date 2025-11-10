declare module "@apgms/shared" {
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
    subscribe(
      subject: string,
      durable: string,
      onMsg: (message: BusEnvelope) => Promise<void>,
    ): Promise<() => Promise<void>>;
  }

  export class InMemoryEventBus implements EventBus {
    publish<T>(subject: string, msg: BusEnvelope<T>): Promise<void>;
    subscribe(
      subject: string,
      durable: string,
      onMsg: (message: BusEnvelope) => Promise<void>,
    ): Promise<() => Promise<void>>;
  }

  export interface NatsBusOptions {
    url: string;
    stream: string;
    subjectPrefix: string;
    connectionName?: string;
  }

  export class NatsBus implements EventBus {
    static connect(options: NatsBusOptions): Promise<NatsBus>;
    publish<T>(subject: string, msg: BusEnvelope<T>): Promise<void>;
    subscribe(
      subject: string,
      durable: string,
      onMsg: (message: BusEnvelope) => Promise<void>,
    ): Promise<() => Promise<void>>;
    close(): Promise<void>;
  }
}
