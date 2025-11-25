import type { BasPeriodId } from "./bas-types";
import type { BasReconciliationService } from "./bas-reconciliation";
import type { JournalWriter } from "@apgms/ledger";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings";
export interface BasLodgmentInput {
    orgId: string;
    basPeriodId: BasPeriodId;
    actorUserId: string;
}
export interface BasLodgmentResult {
    basPeriodId: BasPeriodId;
    paygwCents: number;
    gstCents: number;
    journalId: string;
}
export declare class BasLodgmentService {
    private readonly reconciliationService;
    private readonly journalWriter;
    private readonly mappings;
    constructor(reconciliationService: BasReconciliationService, journalWriter: JournalWriter, mappings: DesignatedAccountMappingRepository);
    lodge(input: BasLodgmentInput): Promise<BasLodgmentResult>;
}
