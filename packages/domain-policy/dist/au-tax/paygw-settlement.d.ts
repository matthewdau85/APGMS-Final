import { PaygwEngine } from "./paygw-engine";
import type { BasPeriodId } from "./bas-types";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings";
export interface PayrollLine {
    employeeId: string;
    grossCents: number;
    payDate: Date;
    payPeriod: "weekly" | "fortnightly" | "monthly";
}
export interface PayrollBatch {
    orgId: string;
    basPeriodId: BasPeriodId;
    lines: PayrollLine[];
}
export interface PaygwSettlementResult {
    totalPaygwCents: number;
    journalId: string;
}
export declare class PaygwSettlementService {
    private readonly engine;
    private readonly mappingRepo;
    private readonly journalWriter;
    constructor(engine: PaygwEngine, mappingRepo: DesignatedAccountMappingRepository, journalWriter: JournalWriter);
    settleBatch(batch: PayrollBatch): Promise<PaygwSettlementResult>;
}
