import { BasePayrollProvider } from "./base.js";
import type { PayrollProviderContext } from "./types.js";

const scheduleLookup: Record<string, string> = {
  hospitality_casual: "hospitality_paygw_casual",
  hospitality_salary: "hospitality_paygw_salary",
  construction_apprentice: "construction_paygw_apprentice",
  construction_contractor: "construction_paygw_contractor",
  health_shift: "health_paygw_shift",
  health_salary: "health_paygw_salary",
};

function resolveSchedule(context: PayrollProviderContext): string[] | undefined {
  if (context.schedulePreference && scheduleLookup[context.schedulePreference]) {
    return [scheduleLookup[context.schedulePreference]];
  }

  if (context.industryId === "hospitality_tourism") {
    return context.seasonalRatio && context.seasonalRatio > 0.45
      ? ["hospitality_paygw_casual"]
      : ["hospitality_paygw_salary"];
  }

  if (context.industryId === "construction_trades") {
    return context.apprenticeCount && context.apprenticeCount > 0
      ? ["construction_paygw_apprentice"]
      : ["construction_paygw_contractor"];
  }

  if (context.industryId === "healthcare_allied") {
    return context.seasonalRatio && context.seasonalRatio > 0.5
      ? ["health_paygw_shift"]
      : ["health_paygw_salary"];
  }

  return undefined;
}

export class XeroPayrollProvider extends BasePayrollProvider {
  constructor() {
    super(
      "xero",
      { supports: ["weekly", "fortnightly", "monthly"] },
      resolveSchedule,
    );
  }
}
