type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

/**
 * Reconciliation use-cases supported by the ML service. The list is derived from
 * stakeholder workshops documented in ADR-002.
 */
export type ReconUseCase = "PAYROLL_TO_BANK" | "BAS_SOURCE_OF_TRUTH";

/**
 * Execution latency tier requested by the caller. `SYNC` is used for inline
 * calls (e.g. worker jobs waiting for a response). `ASYNC` lets the service
 * batch multiple cases without blocking the caller.
 */
export type ReconLatencyTier = "SYNC" | "ASYNC";

/**
 * Canonical representation of a record supplied to the reconciliation model.
 */
export interface ReconCandidateRecord {
  recordId: string;
  /**
   * Logical source of the record. Consumers should use domain specific names
   * such as `payroll-ledger`, `bank-transaction`, or `source-document`.
   */
  source: string;
  /**
   * Structured fields that the feature pipeline understands. The keys should
   * map to features registered for the use-case (e.g. amount, payeeBsb).
   */
  attributes: Record<string, JsonValue>;
}

/**
 * Relationship between two candidate records that the model should score.
 */
export interface ReconCandidateLink {
  leftRecordId: string;
  rightRecordId: string;
  /** Optional weight provided by deterministic rules. */
  ruleHintWeight?: number;
}

/**
 * Request contract shared by API gateway and worker jobs. Callers supply the
 * organisation, a correlation id, the use-case, and the records to compare.
 */
export interface ReconScoringRequest {
  orgId: string;
  caseId: string;
  useCase: ReconUseCase;
  latencyTier: ReconLatencyTier;
  candidateRecords: ReconCandidateRecord[];
  candidateLinks: ReconCandidateLink[];
  /** ISO8601 timestamp when the case was assembled. */
  requestedAtIso: string;
  /** Optional trace or audit token for downstream observability. */
  traceToken?: string;
}

export type ReconDecision =
  | "AUTO_RECONCILED"
  | "PARTIAL_MATCH"
  | "REQUIRES_REVIEW"
  | "NO_MATCH";

/**
 * Confidence scores returned per matched pair.
 */
export interface ReconMatchScore {
  leftRecordId: string;
  rightRecordId: string;
  confidence: number;
  /** Additional metadata to display in UI or audit logs. */
  annotations?: Record<string, JsonValue>;
}

export type ReconFallbackAction =
  | "ROUTE_TO_MANUAL_REVIEW"
  | "APPLY_POLICY_RULES_ONLY"
  | "RETRY_ASYNC";

export interface ReconFallbackInstruction {
  reasonCode:
    | "LOW_CONFIDENCE"
    | "MODEL_UNAVAILABLE"
    | "INVALID_INPUT"
    | "SERVICE_TIMEOUT";
  action: ReconFallbackAction;
  /** Human readable note for audit logging. */
  message: string;
}

/**
 * Response contract that all callers must handle. The ML service always returns
 * the thresholds it used so downstream artefacts can cite them in evidence.
 */
export interface ReconScoringResponse {
  orgId: string;
  caseId: string;
  useCase: ReconUseCase;
  modelVersion: string;
  decision: ReconDecision;
  overallConfidence: number;
  appliedThresholds: ReconConfidenceThresholds;
  matchScores: ReconMatchScore[];
  fallback?: ReconFallbackInstruction;
  processedAtIso: string;
  traceToken?: string;
}

/**
 * Thresholds applied to a use-case. `autoAccept` indicates the minimum
 * confidence required to auto reconcile. `review` is the lower bound for
 * recommending manual review instead of flagging a hard mismatch.
 */
export interface ReconConfidenceThresholds {
  autoAccept: number;
  manualReview: number;
  alertOnBelow: number;
}

/**
 * Expected latency targets (P95) derived from stakeholder commitments.
 */
export const RECON_LATENCY_TARGET_MS: Record<ReconUseCase, {
  sync: number;
  async: number;
}> = {
  PAYROLL_TO_BANK: {
    sync: 750,
    async: 5000,
  },
  BAS_SOURCE_OF_TRUTH: {
    sync: 400,
    async: 1500,
  },
};

/**
 * Default confidence thresholds negotiated with stakeholders. These defaults
 * can be overridden per-organisation but provide a consistent baseline.
 */
export const RECON_CONFIDENCE_THRESHOLDS: Record<ReconUseCase, ReconConfidenceThresholds> = {
  PAYROLL_TO_BANK: {
    autoAccept: 0.92,
    manualReview: 0.75,
    alertOnBelow: 0.6,
  },
  BAS_SOURCE_OF_TRUTH: {
    autoAccept: 0.9,
    manualReview: 0.7,
    alertOnBelow: 0.5,
  },
};

/**
 * Workers use this payload when enqueuing asynchronous reconciliation cases.
 */
export interface ReconWorkerJobPayload {
  request: ReconScoringRequest;
  /** Unique identifier for the worker execution that enqueued the job. */
  jobRunId: string;
  /** ISO8601 timestamp when the job was enqueued. */
  enqueuedAtIso: string;
}

/**
 * Result emitted by background jobs after processing a reconciliation response.
 * This allows downstream pipelines to persist artefacts and audits.
 */
export interface ReconWorkerResult {
  request: ReconScoringRequest;
  response: ReconScoringResponse;
  /** When true the worker emitted a manual-review task as a fallback. */
  manualReviewTriggered: boolean;
}
