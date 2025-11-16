import { BasePosProvider } from "./base.js";
import type { PosProviderContext } from "./types.js";

export class LightspeedPosProvider extends BasePosProvider {
  constructor() {
    super("lightspeed");
  }

  protected resolveSchedules(context: PosProviderContext): string[] | undefined {
    if (context.schedulePreference) {
      return [context.schedulePreference];
    }

    if (context.industryId === "hospitality_tourism" && context.remoteWorkforcePercent && context.remoteWorkforcePercent > 0.5) {
      return ["hospitality_gst_standard"];
    }

    if (context.industryId === "healthcare_allied" && context.isNotForProfit) {
      return ["health_gst_mixed"];
    }

    return undefined;
  }
}
