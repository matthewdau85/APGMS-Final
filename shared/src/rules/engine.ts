import catalog from "./industry-rules.json" assert { type: "json" };
import {
  type AppliedRuleExemption,
  type IndustryRuleCatalog,
  type IndustryRuleEvaluationResult,
  type IndustryRuleProfile,
  type RuleCalculation,
  type RuleCondition,
  type RuleEvaluation,
  type RuleEvaluationContext,
  type RuleEvaluationInput,
  type RuleExemption,
  type RuleExemptionEffect,
  type RuleSchedule,
} from "./types.js";

const DEFAULT_CATALOG = catalog as unknown as IndustryRuleCatalog;

export class IndustryRuleEngine {
  private readonly catalog: IndustryRuleCatalog;
  private readonly profilesById: Map<string, IndustryRuleProfile>;

  constructor(data: IndustryRuleCatalog = DEFAULT_CATALOG) {
    this.catalog = data;
    this.profilesById = new Map(
      this.catalog.industries.map((industry: IndustryRuleProfile) => [industry.id, industry]),
    );
  }

  listIndustries(): readonly IndustryRuleProfile[] {
    return this.catalog.industries;
  }

  getIndustry(industryId: string): IndustryRuleProfile | null {
    return this.profilesById.get(industryId) ?? null;
  }

  evaluate(input: RuleEvaluationInput): IndustryRuleEvaluationResult {
    const profile = this.profilesById.get(input.industryId);
    if (!profile) {
      throw new Error(`Unknown industry id ${input.industryId}`);
    }

    const scheduleFilter = new Set(input.scheduleIds ?? []);
    const schedulesToProcess = profile.schedules.filter((schedule) => {
      if (scheduleFilter.size === 0) {
        return true;
      }
      return scheduleFilter.has(schedule.id);
    });

    const evaluations = schedulesToProcess.map((schedule) =>
      this.evaluateSchedule(profile, schedule, input),
    );

    const total = roundCurrency(
      evaluations.reduce((sum, schedule) => sum + schedule.calculatedAmount, 0),
    );

    return {
      industryId: profile.id,
      industryLabel: profile.label,
      schedules: evaluations,
      total,
      notes: profile.smeNotes,
    };
  }

  private evaluateSchedule(
    profile: IndustryRuleProfile,
    schedule: RuleSchedule,
    input: RuleEvaluationInput,
  ): RuleEvaluation {
    const baseAmount = this.resolveBaseAmount(schedule, input);
    const context: RuleEvaluationContext = { ...input, baseAmount, schedule };
    const { effectiveBase, appliedExemptions, suspended, rateMultiplier } =
      this.applyExemptions(profile.exemptions, schedule, context);

    if (suspended) {
      return {
        scheduleId: schedule.id,
        taxType: schedule.taxType,
        calculatedAmount: 0,
        baseAmount,
        effectiveBaseAmount: effectiveBase,
        appliedExemptions,
        metadata: schedule.metadata,
      };
    }

    const calculated = this.executeCalculation(
      schedule.calculation,
      effectiveBase,
    );

    const adjusted = roundCurrency(calculated * rateMultiplier);

    return {
      scheduleId: schedule.id,
      taxType: schedule.taxType,
      calculatedAmount: adjusted,
      baseAmount,
      effectiveBaseAmount: effectiveBase,
      appliedExemptions,
      metadata: schedule.metadata,
    };
  }

  private resolveBaseAmount(
    schedule: RuleSchedule,
    input: RuleEvaluationInput,
  ): number {
    switch (schedule.basis) {
      case "payroll":
        return Math.max(0, input.payrollAmount ?? 0);
      case "revenue":
        return Math.max(0, input.revenueAmount ?? 0);
      default:
        return 0;
    }
  }

  private executeCalculation(calculation: RuleCalculation, base: number): number {
    if (base <= 0) {
      return 0;
    }

    switch (calculation.type) {
      case "percentage": {
        const threshold = calculation.threshold ?? 0;
        const minimum = calculation.minimum ?? 0;
        const taxable = Math.max(0, base - threshold);
        return Math.max(minimum, taxable * calculation.rate);
      }
      case "progressive": {
        const tiers = [...calculation.tiers];
        for (const tier of tiers) {
          if (tier.upTo === null || base <= tier.upTo) {
            return Math.max(0, tier.base + tier.rate * base);
          }
        }
        return Math.max(0, tiers[tiers.length - 1].base + tiers[tiers.length - 1].rate * base);
      }
      case "fixed":
        return Math.max(0, calculation.amount);
      default:
        return 0;
    }
  }

  private applyExemptions(
    exemptions: readonly RuleExemption[],
    schedule: RuleSchedule,
    context: RuleEvaluationContext,
  ): {
    effectiveBase: number;
    appliedExemptions: AppliedRuleExemption[];
    suspended: boolean;
    rateMultiplier: number;
  } {
    let effectiveBase = context.baseAmount;
    let rateMultiplier = 1;
    let suspended = false;
    const applied: AppliedRuleExemption[] = [];

    const matching = exemptions.filter((exemption) =>
      exemption.appliesTo.includes(schedule.id),
    );

    for (const exemption of matching) {
      if (!this.evaluateCondition(exemption.condition, context)) {
        continue;
      }

      applied.push({
        id: exemption.id,
        description: exemption.description,
        effect: exemption.effect,
      });

      switch (exemption.effect.type) {
        case "amount_discount":
          effectiveBase = Math.max(0, effectiveBase - exemption.effect.amount);
          break;
        case "rate_discount":
          rateMultiplier *= exemption.effect.multiplier;
          break;
        case "suspend":
          suspended = true;
          break;
        default:
          break;
      }
    }

    return {
      effectiveBase,
      appliedExemptions: applied,
      suspended,
      rateMultiplier,
    };
  }

  private evaluateCondition(
    condition: RuleCondition,
    context: RuleEvaluationContext,
  ): boolean {
    const field = condition.field;
    const value = context[field];
    switch (condition.operator) {
      case "gte":
        return typeof value === "number" && typeof condition.value === "number"
          ? value >= condition.value
          : false;
      case "gt":
        return typeof value === "number" && typeof condition.value === "number"
          ? value > condition.value
          : false;
      case "lte":
        return typeof value === "number" && typeof condition.value === "number"
          ? value <= condition.value
          : false;
      case "lt":
        return typeof value === "number" && typeof condition.value === "number"
          ? value < condition.value
          : false;
      case "eq":
        return condition.value === undefined
          ? value === undefined
          : value === condition.value;
      default:
        return false;
    }
  }
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
