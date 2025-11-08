import { Prisma, type PrismaClient } from "@prisma/client";

export type AnalyticsEventPayload = {
  orgId: string;
  eventType: string;
  occurredAt: Date;
  payload: unknown;
  labels?: Record<string, unknown>;
  dedupeKey?: string;
  domain?: string;
  source?: string;
};

export type AnalyticsEventLogger = (event: AnalyticsEventPayload) => Promise<void>;

type RequiredEventPayload = AnalyticsEventPayload & {
  domain: string;
  source: string;
};

const jsonReplacer = (_key: string, value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value === undefined) {
    return null;
  }

  return value;
};

function toJsonValue(value: unknown): Prisma.JsonValue {
  if (value === undefined) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value, jsonReplacer)) as Prisma.JsonValue;
}

export async function recordAnalyticsEvent(
  prisma: PrismaClient,
  event: RequiredEventPayload,
): Promise<void> {
  const labels =
    event.labels === undefined ? undefined : toJsonValue(event.labels ?? Prisma.JsonNull);

  await prisma.analyticsEvent.create({
    data: {
      orgId: event.orgId,
      domain: event.domain,
      source: event.source,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      payload: toJsonValue(event.payload),
      labels,
      dedupeKey: event.dedupeKey,
    },
  });
}

export function createAnalyticsEventLogger(
  prisma: PrismaClient,
  defaults: { domain: string; source: string },
): AnalyticsEventLogger {
  return async (event) => {
    const resolved: RequiredEventPayload = {
      ...event,
      domain: event.domain ?? defaults.domain,
      source: event.source ?? defaults.source,
    } as RequiredEventPayload;

    await recordAnalyticsEvent(prisma, resolved);
  };
}
