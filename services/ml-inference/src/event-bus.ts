import type { EventBus } from "@apgms/shared";
import { InMemoryEventBus, NatsBus } from "@apgms/shared";

export interface EventBusConfig {
  mode: "in-memory" | "nats";
  natsUrl?: string;
  natsStream?: string;
  natsSubjectPrefix?: string;
  connectionName?: string;
}

export async function buildEventBus(config: EventBusConfig): Promise<EventBus> {
  if (config.mode === "in-memory") {
    return new InMemoryEventBus();
  }

  if (!config.natsUrl || !config.natsStream || !config.natsSubjectPrefix) {
    throw new Error("NATS configuration missing required fields");
  }

  return NatsBus.connect({
    url: config.natsUrl,
    stream: config.natsStream,
    subjectPrefix: config.natsSubjectPrefix,
    connectionName: config.connectionName,
  });
}
