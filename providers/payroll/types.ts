import type { IndustryRuleEvaluationResult, RuleEvaluationInput } from "@apgms/shared";
import type { PayPeriod } from "@apgms/shared";

export type PayrollProviderId =
  | "xero"
  | "employmentHero"
  | "myob"
  | "generic";

export interface PayrollProviderCapabilities {
  readonly supports: readonly PayPeriod[];
}

export interface PayrollProviderContext {
  readonly industryId: string;
  readonly payPeriod: PayPeriod;
  readonly payrollAmount: number;
  readonly seasonalRatio?: number;
  readonly remoteWorkforcePercent?: number;
  readonly apprenticeCount?: number;
  readonly exportRatio?: number;
  readonly isNotForProfit?: boolean;
  readonly healthcareExemptRatio?: number;
  readonly annualTaxableTurnover?: number;
  readonly schedulePreference?: string;
}

export interface PayrollEvaluationResult {
  readonly providerId: PayrollProviderId;
  readonly totalWithholding: number;
  readonly detail: IndustryRuleEvaluationResult;
}

export interface PayrollProvider {
  readonly id: PayrollProviderId;
  readonly capabilities: PayrollProviderCapabilities;
  calculateWithholding(context: PayrollProviderContext): PayrollEvaluationResult;
}

export type ScheduleResolver = (context: PayrollProviderContext) => string[] | undefined;

export interface PayrollRuleOverride {
  readonly beforeEvaluate?: (input: RuleEvaluationInput) => RuleEvaluationInput;
}
