import type { BasPeriodId, TaxObligationType } from "./bas-types";
import type { DesignatedAccountMappingRepository } from "../designated-accounts/mappings";
import { assertDesignatedAccountMovementAllowed } from "../designated-accounts/guards";

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

export class BasReconciliationService {
  constructor(
    private readonly mappingRepo: DesignatedAccountMappingRepository,
    private readonly ledgerReader: LedgerReader
  ) {}

  async reconcile(input: BasReconciliationInput): Promise<BasReconciliationResult> {
    const types: TaxObligationType[] = ["PAYGW", "GST"];
    const lines: BasReconciliationLine[] = [];

    for (const type of types) {
      const mapping = await this.mappingRepo.getForOrgAndType(input.orgId, type);
      if (!mapping) continue;

      const obligationCents = await this.ledgerReader.sumObligationsForPeriod({
        orgId: input.orgId,
        basPeriodId: input.basPeriodId,
        type,
      });

      const designatedBalanceCents = await this.ledgerReader.getDesignatedAccountBalance({
        accountId: mapping.designatedAccountId,
        basPeriodId: input.basPeriodId,
      });

      const diff = designatedBalanceCents - obligationCents;
      let status: BasReconciliationStatus = "OK";
      if (diff < 0) status = "SHORTFALL";
      if (diff > 0) status = "SURPLUS";

      lines.push({
        type,
        obligationCents,
        designatedBalanceCents,
        status,
        shortfallOrSurplusCents: diff,
      });
    }

    const overallStatus =
      lines.some(l => l.status === "SHORTFALL") ? "SHORTFALL" :
      lines.some(l => l.status === "SURPLUS") ? "SURPLUS" :
      "OK";

    return {
      orgId: input.orgId,
      basPeriodId: input.basPeriodId,
      lines,
      overallStatus,
    };
  }
}
