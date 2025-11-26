import type { BasPeriodId } from "../bas-period.js";
import type { TaxObligationType } from "../tax-types.js";
export interface BasLodgmentInput {
    orgId: string;
    basPeriodId: BasPeriodId;
}
export interface BasLodgmentLine {
    obligationType: TaxObligationType;
    payableCents: number;
}
export interface BasLodgmentResult {
    orgId: string;
    basPeriodId: BasPeriodId;
    lines: BasLodgmentLine[];
    totalPayableCents: number;
}
/**
 * Placeholder BAS lodgment service.
 *
 * Intentionally minimal: lets the rest of the stack compile and gives
 * you a stable surface to flesh out later.
 */
export declare class BasLodgmentService {
    prepareBasLodgment(input: BasLodgmentInput): Promise<BasLodgmentResult>;
}
