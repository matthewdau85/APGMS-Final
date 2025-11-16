import { BasePosProvider } from "./base.js";
import type { PosProviderContext } from "./types.js";

function resolve(context: PosProviderContext): string[] | undefined {
  if (context.schedulePreference) {
    return [context.schedulePreference];
  }

  if (context.industryId === "hospitality_tourism") {
    return ["hospitality_gst_standard"];
  }

  if (context.industryId === "construction_trades") {
    return ["construction_gst_progress"];
  }

  if (context.industryId === "healthcare_allied") {
    return ["health_gst_mixed"];
  }

  return undefined;
}

export class SquarePosProvider extends BasePosProvider {
  constructor() {
    super("square");
  }

  protected resolveSchedules(context: PosProviderContext): string[] | undefined {
    return resolve(context);
  }
}
