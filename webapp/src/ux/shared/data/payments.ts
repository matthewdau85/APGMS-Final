import { apiRequest } from "./apiClient";

export type PaymentPlan = {
  id: string;
  basCycleId: string;
  status: string;
  reason: string;
  requestedAt: string;
};

export async function fetchPaymentPlans(token: string) {
  return apiRequest<{ plans: PaymentPlan[] }>("/payment-plans", { token });
}
