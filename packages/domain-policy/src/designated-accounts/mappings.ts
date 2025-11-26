// packages/domain-policy/src/designated-accounts/mappings.ts

import type { TaxObligationType } from "../tax-types.js";

export interface DesignatedAccountMapping {
  orgId: string;
  type: TaxObligationType; // "PAYGW" | "GST" | ...
  designatedAccountId: string;
}

export interface DesignatedAccountMappingRepository {
  getForOrgAndType(
    orgId: string,
    type: TaxObligationType
  ): Promise<DesignatedAccountMapping | null>;

  setForOrgAndType(mapping: DesignatedAccountMapping): Promise<void>;
}
