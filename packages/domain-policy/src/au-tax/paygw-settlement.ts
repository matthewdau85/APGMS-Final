// packages/domain-policy/src/au-tax/paygw-settlement.ts

import type { BasPeriodId } from "../bas-period.js";
import type { TaxObligationType } from "../tax-types.js";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings.js";

export interface TaxSettlementInput {
  orgId: string;
  basPeriodId: BasPeriodId;
  obligationType: TaxObligationType;
}

export interface TaxSettlementResult {
  orgId: string;
  basPeriodId: BasPeriodId;
  obligationType: TaxObligationType;
  designatedAccountId: string | null;
}

/**
 * Generic settlement helper that resolves which designated account
 * a given tax obligation should be paid into.
 */
export class TaxSettlementService {
  constructor(
    private readonly mappings: DesignatedAccountMappingRepository
  ) {}

  async resolveSettlementAccount(
    input: TaxSettlementInput
  ): Promise<TaxSettlementResult> {
    const mapping = await this.mappings.getForOrgAndType(
      input.orgId,
      input.obligationType
    );

    return {
      orgId: input.orgId,
      basPeriodId: input.basPeriodId,
      obligationType: input.obligationType,
      designatedAccountId: mapping?.designatedAccountId ?? null,
    };
  }
}
