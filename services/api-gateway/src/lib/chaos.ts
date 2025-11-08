import type { FastifyBaseLogger } from "fastify";

export type ChaosEventType = "dependency_outage" | "recovery" | "verification" | "note";

export type ChaosEvent = {
  type: ChaosEventType;
  detail: string;
  at: string;
  metadata?: Record<string, unknown>;
};

export type ChaosState = {
  enabled: boolean;
  dependencies: {
    dbDown: boolean;
    queueBacklog: Record<string, number>;
  };
  events: ChaosEvent[];
  recordEvent: (
    type: ChaosEventType,
    detail: string,
    metadata?: Record<string, unknown>
  ) => ChaosEvent;
};

const MAX_EVENT_HISTORY = 50;

export function createChaosState(logger: FastifyBaseLogger, enabled: boolean): ChaosState {
  const state: ChaosState = {
    enabled,
    dependencies: {
      dbDown: false,
      queueBacklog: {},
    },
    events: [],
    recordEvent(type, detail, metadata = {}) {
      const event: ChaosEvent = {
        type,
        detail,
        at: new Date().toISOString(),
        metadata,
      };
      state.events.push(event);
      if (state.events.length > MAX_EVENT_HISTORY) {
        state.events.shift();
      }
      logger.warn({ event }, "chaos_drill_event");
      return event;
    },
  };

  if (enabled) {
    state.recordEvent("note", "Chaos drill endpoints enabled", {});
  }

  return state;
}
