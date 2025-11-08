import { BasePosProvider } from "./base.js";
import type { NormalizedPosEvent } from "./types.js";

export type MockPosEvent = {
  eventRef: string;
  occurredAt: string | Date;
  taxableSales: number;
  gstCollected: number;
  inputTaxCredits?: number;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type MockPosPayload = {
  events: MockPosEvent[];
};

export class MockPosProvider extends BasePosProvider {
  constructor() {
    super("mock");
  }

  protected normalize(payload: unknown): NormalizedPosEvent[] {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const data = payload as Partial<MockPosPayload>;
    const events = Array.isArray(data.events) ? data.events : [];

    return events.map((event, index) => {
      if (!event || typeof event !== "object") {
        throw new Error(`Invalid POS event at index ${index}`);
      }
      if (!event.eventRef) {
        throw new Error("POS event missing eventRef");
      }
      const occurredAt = toDate(event.occurredAt, "occurredAt");
      const taxableSales = Number(event.taxableSales ?? 0);
      const gstCollected = Number(event.gstCollected ?? 0);
      const inputCredits = Number(event.inputTaxCredits ?? 0);
      const netGst = gstCollected - inputCredits;

      return {
        eventRef: String(event.eventRef),
        occurredAt,
        taxableSales,
        gstCollected,
        inputTaxCredits: inputCredits,
        netGstOwed: netGst,
        source: event.source?.toString() ?? "GST_CAPTURE",
        metadata: event.metadata,
      } satisfies NormalizedPosEvent;
    });
  }
}

function toDate(value: string | Date | undefined, field: string): Date {
  if (!value) {
    throw new Error(`POS event missing ${field}`);
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date for ${field}: ${value}`);
  }
  return parsed;
}
