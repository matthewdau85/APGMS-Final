export type ApiSession = {
    token: string;
    user: {
        id: string;
        orgId: string;
        role: string;
        mfaEnabled: boolean;
    };
};
export type BankLine = {
    id: string;
    postedAt: string;
    amount: number;
    description: string;
    createdAt: string;
};
export declare function login(email: string, password: string): Promise<ApiSession>;
export declare function initiateMfa(token: string): Promise<{
    delivery: string;
    code: string;
    expiresInSeconds: number;
}>;
export declare function verifyMfa(token: string, code: string): Promise<{
    token: string;
    user: ApiSession["user"];
    session: {
        expiresInSeconds: number;
        verifiedAt: string;
    };
}>;
export declare function fetchUsers(token: string): Promise<{
    users: Array<{
        userId: string;
        email: string;
        createdAt: string;
    }>;
}>;
export declare function fetchBankLines(token: string): Promise<{
    lines: BankLine[];
}>;
export declare function getBankLines(token: string): Promise<{
    lines: BankLine[];
}>;
export declare function createBankLine(token: string, line: {
    date: string;
    amount: string;
    payee: string;
    desc: string;
}): Promise<any>;
export declare function fetchCurrentObligations(token: string): Promise<{
    basCycleId: string | null;
    basPeriodStart: string;
    basPeriodEnd: string;
    paygw: {
        required: number;
        secured: number;
        shortfall: number;
        status: string;
    };
    gst: {
        required: number;
        secured: number;
        shortfall: number;
        status: string;
    };
    nextBasDue: string | null;
}>;
export declare function fetchPayrollFeeds(token: string): Promise<{
    runs: Array<{
        id: string;
        date: string;
        grossWages: number;
        paygwCalculated: number;
        paygwSecured: number;
        status: string;
    }>;
}>;
export declare function fetchGstFeeds(token: string): Promise<{
    days: Array<{
        date: string;
        salesTotal: number;
        gstCalculated: number;
        gstSecured: number;
        status: string;
    }>;
}>;
export declare function fetchAlerts(token: string): Promise<{
    alerts: Array<{
        id: string;
        type: string;
        severity: string;
        message: string;
        createdAt: string;
        resolved: boolean;
        resolvedAt: string | null;
        resolutionNote: string | null;
    }>;
}>;
export declare function resolveAlert(token: string, alertId: string, note: string, mfaCode?: string): Promise<{
    alert: {
        id: string;
        resolved: boolean;
        resolvedAt: string | null;
        resolutionNote: string | null;
    };
}>;
export declare function fetchBasPreview(token: string): Promise<{
    basCycleId: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    paygw: {
        required: number;
        secured: number;
        status: string;
    };
    gst: {
        required: number;
        secured: number;
        status: string;
    };
    overallStatus: string;
    blockers: string[];
}>;
export declare function lodgeBas(token: string, options?: {
    mfaCode?: string;
}): Promise<{
    basCycle: {
        id: string;
        status: string;
        lodgedAt: string;
    };
}>;
export declare function fetchComplianceReport(token: string): Promise<{
    orgId: string;
    basHistory: Array<{
        period: string;
        lodgedAt: string;
        status: string;
        notes: string;
    }>;
    alertsSummary: {
        openHighSeverity: number;
        resolvedThisQuarter: number;
    };
    nextBasDue: string | null;
    designatedTotals: {
        paygw: number;
        gst: number;
    };
    paymentPlans: Array<{
        id: string;
        basCycleId: string;
        requestedAt: string;
        status: string;
        reason: string;
        details: Record<string, unknown>;
        resolvedAt: string | null;
    }>;
}>;
export declare function fetchSecurityUsers(token: string): Promise<{
    users: Array<{
        id: string;
        email: string;
        role: string;
        mfaEnabled: boolean;
        createdAt: string;
        lastLogin: string | null;
    }>;
}>;
export declare function fetchDesignatedAccounts(token: string): Promise<{
    totals: {
        paygw: number;
        gst: number;
    };
    accounts: Array<{
        id: string;
        type: string;
        balance: number;
        updatedAt: string;
        transfers: Array<{
            id: string;
            amount: number;
            source: string;
            createdAt: string;
        }>;
    }>;
}>;
export declare function fetchPaymentPlanRequest(token: string, basCycleId?: string): Promise<{
    request: {
        id: string;
        basCycleId: string;
        requestedAt: string;
        status: string;
        reason: string;
        details: Record<string, unknown>;
        resolvedAt: string | null;
    } | null;
}>;
export declare function createPaymentPlanRequest(token: string, payload: {
    basCycleId: string;
    reason: string;
    weeklyAmount: number;
    startDate: string;
    notes?: string;
}): Promise<{
    request: {
        id: string;
        basCycleId: string;
        requestedAt: string;
        status: string;
        reason: string;
        details: Record<string, unknown>;
        resolvedAt: string | null;
    };
}>;
export declare function fetchEvidenceArtifacts(token: string): Promise<{
    artifacts: Array<{
        id: string;
        kind: string;
        sha256: string;
        wormUri: string;
        createdAt: string;
    }>;
}>;
export declare function createEvidenceArtifact(token: string): Promise<{
    artifact: {
        id: string;
        sha256: string;
        createdAt: string;
        wormUri: string;
    };
}>;
export declare function fetchEvidenceArtifactDetail(token: string, artifactId: string): Promise<{
    artifact: {
        id: string;
        kind: string;
        sha256: string;
        wormUri: string;
        createdAt: string;
        payload: Record<string, unknown> | null;
    };
}>;
export type RegulatorLoginResponse = {
    token: string;
    session: {
        id: string;
        issuedAt: string;
        expiresAt: string;
        sessionToken: string;
    };
};
export declare function regulatorLogin(accessCode: string, orgId?: string): Promise<{
    orgId: string;
    token: string;
    session: {
        id: string;
        issuedAt: string;
        expiresAt: string;
        sessionToken: string;
    };
}>;
export declare function fetchRegulatorComplianceReport(token: string): Promise<{
    orgId: string;
    basHistory: Array<{
        period: string;
        lodgedAt: string | null;
        status: string;
        notes: string;
    }>;
    paymentPlans: Array<{
        id: string;
        basCycleId: string;
        requestedAt: string;
        status: string;
        reason: string;
        details: Record<string, unknown>;
        resolvedAt: string | null;
    }>;
    alertsSummary: {
        openHighSeverity: number;
        resolvedThisQuarter: number;
    };
    nextBasDue: string | null;
    designatedTotals: {
        paygw: number;
        gst: number;
    };
}>;
export declare function fetchRegulatorAlerts(token: string): Promise<{
    alerts: Array<{
        id: string;
        type: string;
        severity: string;
        message: string;
        createdAt: string;
        resolved: boolean;
        resolvedAt: string | null;
    }>;
}>;
export declare function fetchRegulatorMonitoringSnapshots(token: string, limit?: number): Promise<{
    snapshots: Array<{
        id: string;
        type: string;
        createdAt: string;
        payload: {
            generatedAt: string;
            alerts: {
                total: number;
                openHigh: number;
                openMedium: number;
                recent: Array<{
                    id: string;
                    type: string;
                    severity: string;
                    createdAt: string;
                    resolved: boolean;
                }>;
            };
            paymentPlansOpen: number;
            designatedTotals: {
                paygw: number;
                gst: number;
            };
            bas: null | {
                overallStatus: string;
                paygw: {
                    required: number;
                    secured: number;
                    status: string;
                    shortfall?: number;
                };
                gst: {
                    required: number;
                    secured: number;
                    status: string;
                    shortfall?: number;
                };
                blockers: string[];
            };
        };
    }>;
}>;
export declare function fetchRegulatorEvidenceList(token: string): Promise<{
    artifacts: Array<{
        id: string;
        kind: string;
        sha256: string;
        wormUri: string | null;
        createdAt: string;
    }>;
}>;
export declare function fetchRegulatorEvidenceDetail(token: string, artifactId: string): Promise<{
    artifact: {
        id: string;
        kind: string;
        sha256: string;
        wormUri: string | null;
        createdAt: string;
        payload: Record<string, unknown> | null;
    };
}>;
export declare function generateDemoBankLines(token: string, payload?: {
    daysBack?: number;
    intensity?: "low" | "high";
}): Promise<{
    note: string;
    generated: number;
    intensity: string;
    range: string;
    rows: Array<{
        id: string;
        amount: number;
        date: string;
    }>;
}>;
export declare function runDemoPayroll(token: string, payload?: {
    includeBankLines?: boolean;
    note?: string;
}): Promise<{
    note: string;
    payRunId: string;
    totalPaygWithheld: number;
    payslips: number;
}>;
export declare function compileDemoBas(token: string, payload: {
    year: number;
    month: number;
}): Promise<{
    note: string;
    period: {
        year: number;
        month: number;
    };
    gstCollected: number;
    gstCredits: number;
    netGst: number;
    paygWithheld: number;
    bankLines: number;
    payslips: number;
}>;
export declare function fetchRegulatorBankSummary(token: string): Promise<{
    summary: {
        totalEntries: number;
        totalAmount: number;
        firstEntryAt: string | null;
        lastEntryAt: string | null;
    };
    recent: Array<{
        id: string;
        date: string;
        amount: number;
    }>;
}>;
//# sourceMappingURL=api.d.ts.map