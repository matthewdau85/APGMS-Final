import { GstEngine, PosTransaction } from "./gst-engine";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings";
import type { JournalWriter } from "@apgms/ledger";
export interface GstBatch {
    orgId: string;
    transactions: PosTransaction[];
}
export interface GstSettlementResult {
    totalGstCents: number;
    journalId: string;
}
export declare class GstSettlementService {
    private readonly engine;
    private readonly mappingRepo;
    private readonly journalWriter;
    constructor(engine: GstEngine, mappingRepo: DesignatedAccountMappingRepository, journalWriter: JournalWriter);
    settleBatch(batch: GstBatch): Promise<GstSettlementResult>;
}
