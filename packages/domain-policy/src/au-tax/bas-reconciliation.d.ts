import type { BasPeriodId } from "../bas-period.js";
import type { BasPosition } from "./bas-types.js";
/**
 * Simple interface for a BAS reconciliation service.
 * The real implementation can live in a separate module later.
 */
export interface BasReconciliationService {
    reconcile(orgId: string, basPeriodId: BasPeriodId): Promise<BasPosition[]>;
}
