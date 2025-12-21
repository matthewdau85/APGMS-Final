// packages/domain-policy/src/compute/computeWithSpec.ts

import { computeOrgObligationsForPeriod } from "../obligations/computeOrgObligationsForPeriod.js";

export interface ComputeInput {
  taxSpec: {
    id: string;
    version: string;
    jurisdiction: string;
  } | null;

  orgId: string;
  period: string;
}

export function computeWithSpec(input: ComputeInput) {
  if (!input.taxSpec) {
    throw new Error("Tax spec missing");
  }

  return computeOrgObligationsForPeriod(input.orgId, input.period);
}
