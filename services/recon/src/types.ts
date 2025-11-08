export type DesignatedReconciliationSummary = {
  generatedAt: string;
  totals: {
    paygw: number;
    gst: number;
  };
  movementsLast24h: Array<{
    accountId: string;
    type: string;
    balance: number;
    inflow24h: number;
    transferCount24h: number;
  }>;
};

export type ReconModelFeature = {
  name: string;
  weight: number;
  mean: number;
  stdDev: number;
};

export type ReconModel = {
  version: string;
  createdAt: string;
  bias: number;
  decisionThreshold: number;
  confidenceThreshold: number;
  driftStdDeviations: number;
  features: ReconModelFeature[];
};

export type FeatureVector = Record<string, number>;

export type DriftSignal = {
  feature: string;
  score: number;
  threshold: number;
};

export type InferenceComputation = {
  riskScore: number;
  confidence: number;
  decision: "CLEAR" | "REVIEW";
  fallbackRecommended: boolean;
  driftSignals: DriftSignal[];
};

export type InferenceResult = InferenceComputation & {
  artifactId: string;
  generatedAt: string;
  modelVersion: string;
  features: FeatureVector;
};

export type ArtifactSummary = DesignatedReconciliationSummary & {
  artifactId: string;
};
