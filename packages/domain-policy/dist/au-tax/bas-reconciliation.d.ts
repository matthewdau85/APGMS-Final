import type { BasPeriodId, TaxObligationType } from "./bas-types";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings";
import type { LedgerReader } from "@apgms/ledger";
export type BasReconciliationStatus = "OK" | "SHORTFALL" | "SURPLUS";
export interface BasReconciliationInput {
    orgId: string;
    basPeriodId: BasPeriodId;
}
export interface BasReconciliationLine {
    type: TaxObligationType;
    obligationCents: number;
    designatedBalanceCents: number;
    status: BasReconciliationStatus;
    shortfallOrSurplusCents: number;
}
export interface BasReconciliationResult {
    orgId: string;
    basPeriodId: BasPeriodId;
    lines: BasReconciliationLine[];
    overallStatus: BasReconciliationStatus;
}
export declare class BasReconciliationService {
    private readonly mappingRepo;
    private readonly ledgerReader;
    constructor(mappingRepo: DesignatedAccountMappingRepository, ledgerReader: LedgerReader);
    reconcile(input: BasReconciliationInput): Promise<BasReconciliationResult>;
}
