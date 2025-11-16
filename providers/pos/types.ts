import type { IndustryRuleEvaluationResult } from "@apgms/shared";

export type PosProviderId = "square" | "lightspeed" | "generic_pos";

export interface PosProviderContext {
  readonly industryId: string;
  readonly revenueAmount: number;
  readonly exportRatio?: number;
  readonly seasonalRatio?: number;
  readonly remoteWorkforcePercent?: number;
  readonly isNotForProfit?: boolean;
  readonly healthcareExemptRatio?: number;
  readonly annualTaxableTurnover?: number;
  readonly schedulePreference?: string;
}

export interface PosProviderResult {
  readonly providerId: PosProviderId;
  readonly detail: IndustryRuleEvaluationResult;
}

export interface PosProvider {
  readonly id: PosProviderId;
  calculateTaxes(context: PosProviderContext): PosProviderResult;
}
