// webapp/src/ux/shared/data/payments.ts
// ASCII only. LF newlines.

import { apiRequest } from "./apiClient";

export interface PaymentIntent {
  id: string;
  amountCents: number;
  currency: string;
  status: "draft" | "submitted" | "failed" | "settled";
}

export async function listPayments(token?: string | null): Promise<PaymentIntent[]> {
  return apiRequest<PaymentIntent[]>("/api/payments", { method: "GET", token: token ?? null });
}
