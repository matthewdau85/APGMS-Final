import { GstEngine, PosTransaction } from "./gst-engine";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings";
import { assertDesignatedAccountMovementAllowed } from "../designated-accounts/guards";
import type { JournalWriter } from "@apgms/ledger";

export interface GstBatch {
  orgId: string;
  transactions: PosTransaction[];
}

export interface GstSettlementResult {
  totalGstCents: number;
  journalId: string;
}

export class GstSettlementService {
  constructor(
    private readonly engine: GstEngine,
    private readonly mappingRepo: DesignatedAccountMappingRepository,
    private readonly journalWriter: JournalWriter
  ) {}

  async settleBatch(batch: GstBatch): Promise<GstSettlementResult> {
    const mapping = await this.mappingRepo.getForOrgAndType(batch.orgId, "GST");
    if (!mapping) {
      throw new Error(`No GST designated account mapping for org ${batch.orgId}`);
    }

    let totalGstCents = 0;

    for (const tx of batch.transactions) {
      const { gstCents } = this.engine.calculate(tx);
      totalGstCents += gstCents;
    }

    await assertDesignatedAccountMovementAllowed({
      accountId: mapping.designatedAccountId,
      movementType: "DEPOSIT",
      amountCents: totalGstCents,
    });

    const journalId = await this.journalWriter.writeJournal({
      orgId: batch.orgId,
      basPeriodId: batch.transactions[0]?.basPeriodId,
      entries: [
        {
          accountId: mapping.designatedAccountId,
          type: "CREDIT",
          amountCents: totalGstCents,
        },
        {
          accountId: "MAIN_OPERATING", // TODO real account
          type: "DEBIT",
          amountCents: totalGstCents,
        },
      ],
      meta: {
        kind: "GST_SETTLEMENT",
        txCount: batch.transactions.length,
      },
    });

    return { totalGstCents, journalId };
  }
}
