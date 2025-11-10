export type RiskLevel = "low" | "medium" | "high";

export interface RiskAssessment {
  orgId: string;
  score: number;
  riskLevel: RiskLevel;
  recommendedAction: string;
  explanations: string[];
}

export interface ComplianceRiskInsights {
  shortfall: RiskAssessment | null;
  fraud: RiskAssessment | null;
}
