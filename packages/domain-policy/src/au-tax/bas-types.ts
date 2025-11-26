// packages/domain-policy/src/au-tax/bas-types.ts

import type { BasPeriodId } from "../bas-period.js";
import type {
  JurisdictionCode,
  TaxObligationType,
} from "../tax-types.js";

/**
 * A per-BAS-period tax position for a single obligation type
 * (e.g. PAYGW or GST).
 */
export interface BasPosition {
  orgId: string;
  jurisdiction: JurisdictionCode;
  basPeriodId: BasPeriodId;
  obligationType: TaxObligationType;
  debitCents: number;
  creditCents: number;
}
