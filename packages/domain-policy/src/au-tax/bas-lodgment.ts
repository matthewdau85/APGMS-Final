import type { BasPeriodId } from "./bas-types";
import type { BasReconciliationService } from "./bas-reconciliation";
import type { JournalWriter } from "@apgms/ledger";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings";
import { assertDesignatedAccountMovementAllowed } from "../designated-accounts/guards";

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

export class BasLodgmentService {
  constructor(
    private readonly reconciliationService: BasReconciliationService,
    private readonly journalWriter: JournalWriter,
    private readonly mappings: DesignatedAccountMappingRepository
  ) {}

  async lodge(input: BasLodgmentInput): Promise<BasLodgmentResult> {
    const reco = await this.reconciliationService.reconcile({
      orgId: input.orgId,
      basPeriodId: input.basPeriodId,
    });

    if (reco.overallStatus === "SHORTFALL") {
      throw new Error("Cannot lodge BAS: shortfall in designated accounts");
    }

    const paygw = reco.lines.find(l => l.type === "PAYGW");
    const gst = reco.lines.find(l => l.type === "GST");

    const paygwMapping = paygw
      ? await this.mappings.getForOrgAndType(input.orgId, "PAYGW")
      : null;
    const gstMapping = gst
      ? await this.mappings.getForOrgAndType(input.orgId, "GST")
      : null;

    const entries: Array<{ accountId: string; type: "DEBIT" | "CREDIT"; amountCents: number }> = [];

    if (paygw && paygwMapping) {
      entries.push(
        {
          accountId: paygwMapping.designatedAccountId,
          type: "DEBIT",
          amountCents: paygw.designatedBalanceCents,
        },
        {
          accountId: "ATO_PAYGW_CLEARING",
          type: "CREDIT",
          amountCents: paygw.designatedBalanceCents,
        }
      );
    }

    if (gst && gstMapping) {
      entries.push(
        {
          accountId: gstMapping.designatedAccountId,
          type: "DEBIT",
          amountCents: gst.designatedBalanceCents,
        },
        {
          accountId: "ATO_GST_CLEARING",
          type: "CREDIT",
          amountCents: gst.designatedBalanceCents,
        }
      );
    }

    const journalId = await this.journalWriter.writeJournal({
      orgId: input.orgId,
      basPeriodId: input.basPeriodId,
      entries,
      meta: {
        kind: "BAS_LODGMENT",
        actorUserId: input.actorUserId,
      },
    });

    return {
      basPeriodId: input.basPeriodId,
      paygwCents: paygw?.designatedBalanceCents ?? 0,
      gstCents: gst?.designatedBalanceCents ?? 0,
      journalId,
    };
  }
}
