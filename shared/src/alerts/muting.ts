export const DETECTOR_MUTE_SCOPES = ["TENANT", "STREAM", "PERIOD"] as const;
export type DetectorMuteScope = (typeof DETECTOR_MUTE_SCOPES)[number];

export const DETECTOR_MUTE_REASONS = [
  "NONE",
  "TENANT_MUTED",
  "STREAM_MUTED",
  "PERIOD_MUTED",
  "EXPIRED",
] as const;

export type DetectorMuteReason = (typeof DETECTOR_MUTE_REASONS)[number];

export type DetectorMuteRecord = {
  id: string;
  orgId: string;
  scope: DetectorMuteScope;
  streamId?: string | null;
  period?: string | null;
  expiresAt?: Date | null;
};

export type DetectorMetricIdentity = {
  tenantId: string;
  streamId: string;
  period: string;
};

export type DetectorMuteEvaluation = {
  muted: boolean;
  reason: DetectorMuteReason;
  source?: DetectorMuteRecord;
};

export type DetectorMetricPayload<T extends DetectorMetricIdentity> = T & {
  mute: {
    muted: boolean;
    reason: DetectorMuteReason;
    muteId?: string;
    scope?: DetectorMuteScope;
    expiresAt?: string | null;
  };
};

const scopePriority: Record<DetectorMuteScope, number> = {
  TENANT: 1,
  STREAM: 2,
  PERIOD: 3,
};

const mapScopeToReason = (scope: DetectorMuteScope): DetectorMuteReason => {
  switch (scope) {
    case "TENANT":
      return "TENANT_MUTED";
    case "STREAM":
      return "STREAM_MUTED";
    case "PERIOD":
      return "PERIOD_MUTED";
    default:
      return "NONE";
  }
};

const isExpired = (record: DetectorMuteRecord, now: Date): boolean => {
  if (!record.expiresAt) {
    return false;
  }
  return record.expiresAt.getTime() <= now.getTime();
};

const matchesMetric = (
  record: DetectorMuteRecord,
  metric: DetectorMetricIdentity,
): boolean => {
  switch (record.scope) {
    case "TENANT":
      return record.orgId === metric.tenantId;
    case "STREAM":
      return record.orgId === metric.tenantId && record.streamId === metric.streamId;
    case "PERIOD":
      return (
        record.orgId === metric.tenantId &&
        record.streamId === metric.streamId &&
        record.period === metric.period
      );
    default:
      return false;
  }
};

export function evaluateMute(
  records: readonly DetectorMuteRecord[],
  metric: DetectorMetricIdentity,
  now: Date = new Date(),
): DetectorMuteEvaluation {
  let candidate:
    | { record: DetectorMuteRecord; expired: boolean }
    | undefined;

  for (const record of records) {
    if (!matchesMetric(record, metric)) {
      continue;
    }
    const expired = isExpired(record, now);
    if (!candidate) {
      candidate = { record, expired };
      continue;
    }
    if (candidate.expired && !expired) {
      candidate = { record, expired };
      continue;
    }
    if (!candidate.expired && expired) {
      continue;
    }
    const currentPriority = scopePriority[record.scope];
    const candidatePriority = scopePriority[candidate.record.scope];
    if (currentPriority > candidatePriority) {
      candidate = { record, expired };
      continue;
    }
    if (
      currentPriority === candidatePriority &&
      (record.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) >
        (candidate.record.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY)
    ) {
      candidate = { record, expired };
    }
  }

  if (!candidate) {
    return { muted: false, reason: "NONE" };
  }

  if (candidate.expired) {
    return { muted: false, reason: "EXPIRED", source: candidate.record };
  }

  return {
    muted: true,
    reason: mapScopeToReason(candidate.record.scope),
    source: candidate.record,
  };
}

export function embedMuteInMetric<T extends DetectorMetricIdentity>(
  metric: T,
  evaluation: DetectorMuteEvaluation,
): DetectorMetricPayload<T> {
  const muteInfo = evaluation.source;
  return {
    ...metric,
    mute: {
      muted: evaluation.muted,
      reason: evaluation.reason,
      muteId: muteInfo?.id,
      scope: muteInfo?.scope,
      expiresAt: muteInfo?.expiresAt?.toISOString() ?? null,
    },
  };
}
