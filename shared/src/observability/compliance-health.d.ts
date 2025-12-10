export declare function complianceSnapshot(orgId: string, taxType?: string): Promise<{
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
}>;
//# sourceMappingURL=compliance-health.d.ts.map