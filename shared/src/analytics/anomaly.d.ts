import { Decimal } from "@prisma/client/runtime/library";
export type AnomalySeverity = "low" | "medium" | "high";
export declare function formatCurrency(value: Decimal): string;
export declare function analyzeIntegrationAnomaly(orgId: string, taxType: string): Promise<{
    severity: AnomalySeverity;
    score: number;
    latestAmount: number;
    mean: number;
    explanation: string;
    narrative: string;
}>;
//# sourceMappingURL=anomaly.d.ts.map