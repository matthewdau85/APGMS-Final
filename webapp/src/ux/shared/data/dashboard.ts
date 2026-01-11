import { apiRequest } from "./apiClient";

export type ComplianceDiscrepancy = {
  eventId: string;
  reason: string;
  shortfall: string;
  createdAt: string;
};

export type IntegrationAnomaly = {
  severity: string;
  score: number;
  narrative?: string;
  explanation?: string;
};

export type ComplianceReport = {
  orgId: string;
  taxType: string;
  pendingObligations: string;
  discrepancies: ComplianceDiscrepancy[];
  anomaly: IntegrationAnomaly;
  paymentPlans: Array<{
    id: string;
    basCycleId: string;
    status: string;
    reason: string;
    requestedAt: string;
  }>;
  generatedAt: string;
};

export async function fetchComplianceReport(orgId: string, taxType: string): Promise<ComplianceReport> {
  const q = new URLSearchParams({ orgId, taxType });
  return apiRequest<ComplianceReport>(`/integrations/compliance-report?${q.toString()}`);
}
