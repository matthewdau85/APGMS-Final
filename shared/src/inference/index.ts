export type RiskBand = "low" | "medium" | "high";

export interface InferenceFeatureVector {
  payrollVariance: number;
  reconciliationLagDays: number;
  transactionVolume: number;
  alertDensity: number;
}

export interface InferenceRequestBody {
  requestId: string;
  orgId: string;
  features: InferenceFeatureVector;
  requestedAt?: string;
  context?: Record<string, unknown>;
}

export interface InferenceResult {
  requestId: string;
  modelVersion: string;
  score: number;
  riskBand: RiskBand;
  contributingFeatures: Array<{
    feature: keyof InferenceFeatureVector;
    contribution: number;
  }>;
}

export interface InferenceRequestedEvent {
  requestId: string;
  orgId: string;
  features: InferenceFeatureVector;
  requestedAt: string;
  source: string;
  traceId?: string;
}

export interface InferenceCompletedEvent {
  requestId: string;
  orgId: string;
  modelVersion: string;
  score: number;
  riskBand: RiskBand;
  processedAt: string;
  contributingFeatures: Array<{
    feature: keyof InferenceFeatureVector;
    contribution: number;
  }>;
  traceId?: string;
  thresholdBreached: boolean;
}

export function inferenceSubjects(prefix: string) {
  return {
    request: `${prefix}.inference.requested`,
    completed: `${prefix}.inference.completed`,
  } as const;
}
