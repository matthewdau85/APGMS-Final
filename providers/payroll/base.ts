import { IndustryRuleEngine } from "@apgms/shared";

import type {
  PayrollEvaluationResult,
  PayrollProvider,
  PayrollProviderCapabilities,
  PayrollProviderContext,
  PayrollProviderId,
  PayrollRuleOverride,
  ScheduleResolver,
} from "./types.js";

const engine = new IndustryRuleEngine();

export abstract class BasePayrollProvider implements PayrollProvider {
  readonly id: PayrollProviderId;
  readonly capabilities: PayrollProviderCapabilities;
  private readonly resolveSchedules: ScheduleResolver;
  private readonly overrides?: PayrollRuleOverride;

  protected constructor(
    id: PayrollProviderId,
    capabilities: PayrollProviderCapabilities,
    resolveSchedules: ScheduleResolver,
    overrides?: PayrollRuleOverride,
  ) {
    this.id = id;
    this.capabilities = capabilities;
    this.resolveSchedules = resolveSchedules;
    this.overrides = overrides;
  }

  calculateWithholding(context: PayrollProviderContext): PayrollEvaluationResult {
    if (!this.capabilities.supports.includes(context.payPeriod)) {
      throw new Error(
        `${this.id} does not support ${context.payPeriod} pay periods`,
      );
    }

    const scheduleIds = this.resolveSchedules(context);

    const input = this.overrides?.beforeEvaluate
      ? this.overrides.beforeEvaluate({
          industryId: context.industryId,
          payrollAmount: context.payrollAmount,
          payPeriod: context.payPeriod,
          scheduleIds,
          seasonalRatio: context.seasonalRatio,
          remoteWorkforcePercent: context.remoteWorkforcePercent,
          apprenticeCount: context.apprenticeCount,
          exportRatio: context.exportRatio,
          isNotForProfit: context.isNotForProfit,
          healthcareExemptRatio: context.healthcareExemptRatio,
          annualTaxableTurnover: context.annualTaxableTurnover,
        })
      : {
          industryId: context.industryId,
          payrollAmount: context.payrollAmount,
          payPeriod: context.payPeriod,
          scheduleIds,
          seasonalRatio: context.seasonalRatio,
          remoteWorkforcePercent: context.remoteWorkforcePercent,
          apprenticeCount: context.apprenticeCount,
          exportRatio: context.exportRatio,
          isNotForProfit: context.isNotForProfit,
          healthcareExemptRatio: context.healthcareExemptRatio,
          annualTaxableTurnover: context.annualTaxableTurnover,
        };

    const detail = engine.evaluate(input);

    return {
      providerId: this.id,
      totalWithholding: detail.total,
      detail,
    };
  }
}
