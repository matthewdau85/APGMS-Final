export type RiskSeverity = "low" | "medium" | "high";
export declare function detectRisk(orgId: string, taxType?: string): Promise<{
    record: any;
    snapshot: {
        taxType: string;
        pendingObligations: any;
        unresolvedDiscrepancies: any;
        activePaymentPlans: any;
        anomaly: {
            severity: import("../analytics/anomaly.js").AnomalySeverity;
            score: number;
            latestAmount: number;
            mean: number;
            explanation: string;
            narrative: string;
        };
    };
}>;
export declare function listRiskEvents(orgId: string): Promise<any>;
//# sourceMappingURL=risk.d.ts.map