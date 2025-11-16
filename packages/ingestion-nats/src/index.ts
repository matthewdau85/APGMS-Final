import type { BusEnvelope, NatsBus } from "@apgms/shared";

export type IngestionHandler<TPayload> = (message: BusEnvelope<TPayload>) => Promise<void>;

export interface NatsIngestionConsumerConfig<TPayload> {
  readonly bus: NatsBus;
  readonly subject: string;
  readonly durableName: string;
  readonly handler: IngestionHandler<TPayload>;
  readonly onError?: (error: unknown, envelope: BusEnvelope<TPayload>) => void;
}

export interface NatsIngestionConsumer {
  stop: () => Promise<void>;
}

export async function startNatsIngestionConsumer<TPayload>(
  config: NatsIngestionConsumerConfig<TPayload>,
): Promise<NatsIngestionConsumer> {
  const unsubscribe = await config.bus.subscribe(
    config.subject,
    config.durableName,
    async (message) => {
      try {
        await config.handler(message as BusEnvelope<TPayload>);
      } catch (error) {
        config.onError?.(error, message as BusEnvelope<TPayload>);
        throw error;
      }
    },
  );

  return {
    stop: async () => {
      await unsubscribe();
    },
  };
}
