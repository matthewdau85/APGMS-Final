export interface LinearModelDefinition {
  readonly id: string;
  readonly version: string;
  readonly intercept: number;
  readonly weights: Record<string, number>;
  readonly confidence: {
    readonly margin: number;
  };
  readonly recommendations: ReadonlyArray<{
    readonly threshold: number;
    readonly actions: ReadonlyArray<string>;
  }>;
}

export interface RiskEvaluation {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly score: number;
  readonly confidenceInterval: [number, number];
  readonly recommendedActions: ReadonlyArray<string>;
  readonly contributingFeatures: Record<string, number>;
}

export interface ShortfallFeatures {
  readonly orgId: string;
  readonly basCycleId?: string;
  readonly cashCoverageRatio: number;
  readonly varianceIndex: number;
  readonly openAlertRatio: number;
}

export interface FraudFeatures {
  readonly orgId: string;
  readonly velocityScore: number;
  readonly patternDeviation: number;
  readonly vendorConcentration: number;
}

export interface CompliancePlanFeatures {
  readonly orgId: string;
  readonly installmentReliability: number;
  readonly liquidityBuffer: number;
  readonly planHistory: number;
}

export interface FeedbackRecord {
  readonly id: string;
  readonly caseType: string;
  readonly caseId: string;
  readonly orgId: string;
  readonly label: string;
  readonly override?: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly score: number;
  readonly submittedBy?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
}

export interface FeedbackInput {
  readonly caseType: string;
  readonly caseId: string;
  readonly orgId: string;
  readonly label: string;
  readonly override?: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly score: number;
  readonly submittedBy?: string;
  readonly metadata?: Record<string, unknown>;
}
