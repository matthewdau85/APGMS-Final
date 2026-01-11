import { apiRequest } from "./apiClient";

export type RegulatorSummary = {
  totalOrganizations: number;
  compliantOrganizations: number;
  overdueObligations: number;
  criticalIncidents: number;
};

export type RegulatorComplianceReport = {
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
};

export async function fetchRegulatorSummary(orgId: string, period?: string) {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return apiRequest<RegulatorSummary>(`/regulator/compliance/summary${q}`, {
    orgId,
  });
}

export async function fetchRegulatorComplianceReport(token: string) {
  return apiRequest<RegulatorComplianceReport>("/regulator/compliance/report", { token });
}

export async function fetchRegulatorEvidence(token: string) {
  return apiRequest<{
    artifacts: Array<{
      id: string;
      kind: string;
      sha256: string;
      wormUri: string | null;
      createdAt: string;
    }>;
  }>("/regulator/evidence", { token });
}

export async function fetchRegulatorAlerts(token: string) {
  return apiRequest<{
    alerts: Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      createdAt: string;
      resolved: boolean;
      resolvedAt: string | null;
    }>;
  }>("/regulator/alerts", { token });
}
