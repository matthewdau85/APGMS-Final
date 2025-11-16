import { BasePayrollProvider } from "./base.js";
import type { PayrollProviderContext } from "./types.js";

function resolveSchedules(context: PayrollProviderContext): string[] | undefined {
  if (context.schedulePreference) {
    return [context.schedulePreference];
  }

  if (context.industryId === "hospitality_tourism") {
    return ["hospitality_paygw_casual", "hospitality_paygw_salary"];
  }

  if (context.industryId === "healthcare_allied") {
    return ["health_paygw_shift", "health_paygw_salary"];
  }

  if (context.industryId === "construction_trades") {
    return ["construction_paygw_apprentice", "construction_paygw_contractor"];
  }

  return undefined;
}

export class EmploymentHeroPayrollProvider extends BasePayrollProvider {
  constructor() {
    super(
      "employmentHero",
      { supports: ["weekly", "fortnightly"] },
      resolveSchedules,
      {
        beforeEvaluate: (input) => ({
          ...input,
          seasonalRatio: input.seasonalRatio ?? 0.25,
        }),
      },
    );
  }
}
