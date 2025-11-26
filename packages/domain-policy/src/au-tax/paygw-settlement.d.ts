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
export declare class TaxSettlementService {
    private readonly mappings;
    constructor(mappings: DesignatedAccountMappingRepository);
    resolveSettlementAccount(input: TaxSettlementInput): Promise<TaxSettlementResult>;
}
