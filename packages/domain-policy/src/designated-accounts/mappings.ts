import type { TaxObligationType } from "../au-tax/bas-types";

export interface DesignatedAccountMapping {
  orgId: string;
  type: TaxObligationType; // "PAYGW" | "GST"
  designatedAccountId: string;
}

export interface DesignatedAccountMappingRepository {
  getForOrgAndType(
    orgId: string,
    type: TaxObligationType
  ): Promise<DesignatedAccountMapping | null>;

  setForOrgAndType(mapping: DesignatedAccountMapping): Promise<void>;
}
