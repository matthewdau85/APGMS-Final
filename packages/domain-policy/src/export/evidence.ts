// packages/domain-policy/src/export/evidence.ts

import crypto from "crypto";
import type { PeriodObligations } from "../obligations/types.js";
import { computeOrgObligationsForPeriod } from "../obligations/computeOrgObligationsForPeriod.js";
import type { LedgerTotals } from "../ledger/tax-ledger.js";
import {
  getLedgerBalanceForPeriod,
  getLedgerHashForPeriod,
} from "../ledger/tax-ledger.js";

export interface BasEvidencePack {
  orgId: string;
  period: string;

  inputDataHash: string;

  taxSpec: {
    id: string;
    version: string;
    jurisdiction: string;
  };

  computation: {
    timestamp: string;
  };

  outputs: {
    obligations: PeriodObligations;
    ledgerTotals: LedgerTotals;
  };

  ledger: {
    ledgerHash: string;
  };

  system: {
    gitSha: string;
  };

  readiness: {
    status: "GREEN" | "AMBER" | "RED";
    checkedAt: string;
  };

  checksum: string;
}

