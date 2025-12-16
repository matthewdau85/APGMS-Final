// packages/domain-policy/src/au-tax/assert-au-only.ts
import type { JurisdictionCode } from "../tax-types.js";

export function assertAuOnly(j: JurisdictionCode | string): asserts j is "AU" {
  if (j !== "AU") {
    throw new Error(`AU_ONLY: attempted to resolve tax config for jurisdiction=${String(j)}`);
  }
}
