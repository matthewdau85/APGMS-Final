export type LodgmentType = "STP" | "BAS";

export interface AtoClientConfig {
  apiBaseUrl: string;
  tenantId: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface LodgmentPayload<TDetails> {
  id: string;
  type: LodgmentType;
  details: TDetails;
  submittedBy: string;
  submittedAt: string;
}

export interface StpDetails {
  payRunReference: string;
  employeeCount: number;
  grossAmountCents: number;
  paygWithheldCents: number;
}

export interface BasDetails {
  periodStart: string;
  periodEnd: string;
  gstPayableCents: number;
  paygwWithheldCents: number;
  fuelTaxCreditCents?: number;
}

export interface LodgmentResponse {
  lodgmentId: string;
  status: LodgmentStatus;
  acceptedAt?: string;
  nextActionAt?: string;
  message?: string;
  retryWindowSeconds?: number;
}

export type LodgmentStatus =
  | "QUEUED"
  | "SUBMITTED"
  | "ACCEPTED"
  | "REJECTED"
  | "AWAITING_MANUAL_REVIEW";

export interface LodgmentStatusRecord {
  lodgmentId: string;
  type: LodgmentType;
  status: LodgmentStatus;
  attempts: number;
  lastAttemptAt: string;
  nextRetryAt?: string;
  lastError?: string;
}

export interface ManualFallbackTrigger {
  lodgmentId: string;
  reason: string;
  triggeredAt: string;
  assignedTo?: string;
}

