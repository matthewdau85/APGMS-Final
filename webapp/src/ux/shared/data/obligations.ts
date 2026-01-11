import { apiRequest } from "./apiClient";

export type ObligationTotal = {
  orgId: string;
  taxType: string;
  pendingAmount: string;
};

export async function fetchObligationTotals(orgId: string, taxType: string): Promise<ObligationTotal> {
  const q = new URLSearchParams({ orgId, taxType });
  return apiRequest<ObligationTotal>(`/integrations/obligations?${q.toString()}`);
}
