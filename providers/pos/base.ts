import { IndustryRuleEngine } from "@apgms/shared";
import type { PosProvider, PosProviderContext, PosProviderId, PosProviderResult } from "./types.js";

const engine = new IndustryRuleEngine();

export abstract class BasePosProvider implements PosProvider {
  readonly id: PosProviderId;

  protected constructor(id: PosProviderId) {
    this.id = id;
  }

  calculateTaxes(context: PosProviderContext): PosProviderResult {
    const scheduleIds = this.resolveSchedules(context);
    const detail = engine.evaluate({
      industryId: context.industryId,
      revenueAmount: context.revenueAmount,
      scheduleIds,
      exportRatio: context.exportRatio,
      seasonalRatio: context.seasonalRatio,
      remoteWorkforcePercent: context.remoteWorkforcePercent,
      isNotForProfit: context.isNotForProfit,
      healthcareExemptRatio: context.healthcareExemptRatio,
      annualTaxableTurnover: context.annualTaxableTurnover,
    });

    return { providerId: this.id, detail };
  }

  protected abstract resolveSchedules(
    context: PosProviderContext,
  ): string[] | undefined;
}
