export const DETECTOR_NIGHTLY_SUBJECT = "events.detector.nightly";
export const LEDGER_COMPACTION_SUBJECT = "events.ledger.compaction";

export type DetectorNightlyEvent = {
  tenantId: string;
  period: string;
  triggeredAt: string;
};

export type LedgerCompactionEvent = {
  tenantId: string;
  streamId: string;
  period?: string | null;
  triggeredAt: string;
};

export type DetectorCacheInvalidationEvent = {
  tenantId: string;
  streamId?: string | null;
  period?: string | null;
  reason: "nightly_job" | "ledger_compaction";
  triggeredAt: string;
};

export const mapNightlyToInvalidation = (
  event: DetectorNightlyEvent,
): DetectorCacheInvalidationEvent => ({
  tenantId: event.tenantId,
  streamId: null,
  period: event.period,
  reason: "nightly_job",
  triggeredAt: event.triggeredAt,
});

export const mapLedgerCompactionToInvalidation = (
  event: LedgerCompactionEvent,
): DetectorCacheInvalidationEvent => ({
  tenantId: event.tenantId,
  streamId: event.streamId,
  period: event.period ?? null,
  reason: "ledger_compaction",
  triggeredAt: event.triggeredAt,
});
