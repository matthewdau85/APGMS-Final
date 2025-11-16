import type { PayPeriod } from "../tax/index.js";

import type { TaxObligation } from "../ledger/one-way-account.js";

export type { TaxObligation };

export interface IndustryRuleCatalog {
  readonly industries: readonly IndustryRuleProfile[];
}

export interface IndustryRuleProfile {
  readonly id: string;
  readonly label: string;
  readonly naics: readonly string[];
  readonly smeNotes: readonly string[];
  readonly schedules: readonly RuleSchedule[];
  readonly exemptions: readonly RuleExemption[];
}

export type RuleBasis = "payroll" | "revenue";

export interface RuleSchedule {
  readonly id: string;
  readonly taxType: TaxObligation;
  readonly basis: RuleBasis;
  readonly frequency: PayPeriod;
  readonly calculation: RuleCalculation;
  readonly metadata: ScheduleMetadata;
}

export interface ScheduleMetadata {
  readonly scheduleRef: string;
  readonly atoSource: string;
  readonly notes: readonly string[];
}

export type RuleCalculation =
  | PercentageCalculation
  | ProgressiveCalculation
  | FixedCalculation;

export interface PercentageCalculation {
  readonly type: "percentage";
  readonly rate: number;
  readonly threshold?: number;
  readonly minimum?: number;
}

export interface ProgressiveTier {
  readonly upTo: number | null;
  readonly base: number;
  readonly rate: number;
}

export interface ProgressiveCalculation {
  readonly type: "progressive";
  readonly tiers: readonly ProgressiveTier[];
}

export interface FixedCalculation {
  readonly type: "fixed";
  readonly amount: number;
}

export interface RuleExemption {
  readonly id: string;
  readonly description: string;
  readonly condition: RuleCondition;
  readonly effect: RuleExemptionEffect;
  readonly appliesTo: readonly string[];
}

export type RuleConditionOperator = "gte" | "lte" | "gt" | "lt" | "eq";

export interface RuleCondition {
  readonly field: keyof RuleEvaluationContext;
  readonly operator: RuleConditionOperator;
  readonly value?: number | boolean | string;
}

export type RuleExemptionEffect =
  | RateDiscountEffect
  | AmountDiscountEffect
  | SuspendEffect;

export interface RateDiscountEffect {
  readonly type: "rate_discount";
  readonly multiplier: number;
}

export interface AmountDiscountEffect {
  readonly type: "amount_discount";
  readonly amount: number;
}

export interface SuspendEffect {
  readonly type: "suspend";
}

export interface RuleEvaluationInput {
  readonly industryId: string;
  readonly payrollAmount?: number;
  readonly revenueAmount?: number;
  readonly payPeriod?: PayPeriod;
  readonly scheduleIds?: readonly string[];
  readonly seasonalRatio?: number;
  readonly remoteWorkforcePercent?: number;
  readonly annualTaxableTurnover?: number;
  readonly apprenticeCount?: number;
  readonly exportRatio?: number;
  readonly isNotForProfit?: boolean;
  readonly healthcareExemptRatio?: number;
}

export interface RuleEvaluation {
  readonly scheduleId: string;
  readonly taxType: TaxObligation;
  readonly calculatedAmount: number;
  readonly baseAmount: number;
  readonly effectiveBaseAmount: number;
  readonly appliedExemptions: readonly AppliedRuleExemption[];
  readonly metadata: ScheduleMetadata;
}

export interface AppliedRuleExemption {
  readonly id: string;
  readonly description: string;
  readonly effect: RuleExemptionEffect;
}

export interface RuleEvaluationContext extends RuleEvaluationInput {
  readonly baseAmount: number;
  readonly schedule: RuleSchedule;
}

export interface IndustryRuleEvaluationResult {
  readonly industryId: string;
  readonly industryLabel: string;
  readonly total: number;
  readonly schedules: readonly RuleEvaluation[];
  readonly notes: readonly string[];
}
