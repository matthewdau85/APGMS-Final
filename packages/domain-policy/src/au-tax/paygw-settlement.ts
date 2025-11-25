import { PaygwEngine } from "./paygw-engine";
import type { BasPeriodId } from "./bas-types";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings";
import { assertDesignatedAccountMovementAllowed } from "../designated-accounts/guards";


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

export class PaygwSettlementService {
  constructor(
    private readonly engine: PaygwEngine,
    private readonly mappingRepo: DesignatedAccountMappingRepository,
    private readonly journalWriter: JournalWriter
  ) {}

  async settleBatch(batch: PayrollBatch): Promise<PaygwSettlementResult> {
    const mapping = await this.mappingRepo.getForOrgAndType(batch.orgId, "PAYGW");
    if (!mapping) {
      throw new Error(`No PAYGW designated account mapping for org ${batch.orgId}`);
    }

    let totalPaygwCents = 0;

    for (const line of batch.lines) {
      const result = await this.engine.calculate({
        jurisdiction: "AU",
        paymentDate: line.payDate,
        grossCents: line.grossCents,
        payPeriod: line.payPeriod,
        flags: {},
      });

      totalPaygwCents += result.withholdingCents;
    }

    await assertDesignatedAccountMovementAllowed({
      accountId: mapping.designatedAccountId,
      movementType: "DEPOSIT",
      amountCents: totalPaygwCents,
    });

    const journalId = await this.journalWriter.writeJournal({
      orgId: batch.orgId,
      basPeriodId: batch.basPeriodId,
      entries: [
        {
          accountId: mapping.designatedAccountId,
          type: "CREDIT",
          amountCents: totalPaygwCents,
        },
        {
          accountId: "MAIN_OPERATING", // TODO: use real account ID
          type: "DEBIT",
          amountCents: totalPaygwCents,
        },
      ],
      meta: {
        kind: "PAYGW_SETTLEMENT",
        linesCount: batch.lines.length,
      },
    });

    return { totalPaygwCents, journalId };
  }
}
