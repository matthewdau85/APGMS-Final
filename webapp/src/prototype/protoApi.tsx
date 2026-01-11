import { apiRequest } from "../lib/api-client";
import { type EvidenceRef } from "../tax/evidence";
import { computeTax, type TaxObligation } from "../tax/registry";
import type { GstInput } from "../tax/plugins/auGst";
import type { PaygwInput } from "../tax/plugins/auPaygw";
import { getOrgId } from "./protoState";

export type ProtoOverview = {
  kpis?: {
    complianceScore?: number;
    coverageRatio?: number;
    fundedThisPeriod?: number;
    upcomingDueAmount?: number;
  };
  recentActivity?: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    severity?: "low" | "medium" | "high" | "critical";
  }>;
};

export type ProtoObligation = {
  id: string;
  type: string;
  period: string;
  dueDate: string;
  amount: number;
  status: "upcoming" | "in_progress" | "overdue" | "lodged" | "paid";
};

export type GenerateEvidencePackRequest = {
  obligationIds: string[];
  period?: string;
};

export type GenerateEvidencePackResponse = {
  packId: string;
  createdAt?: string;
};

export type LodgeBASRequest = {
  period: string;
  amounts: Record<string, number>;
  mfaCode?: string;
};

export type LodgeBASResponse = {
  status: string;
  receiptId?: string;
  lodgmentDate?: string;
  error?: string;
};

export type PaymentPlanRequest = {
  obligationId: string;
  amount: number;
  instalments: number;
};

export type PaymentPlanResponse = {
  id: string;
  status: "requested" | "approved" | "rejected" | "pending";
  approved?: boolean;
};

export type ProtoEvidenceRef = EvidenceRef;

export type ProtoTaxObligation = TaxObligation & {
  dueDate?: string;
  evidenceRef?: ProtoEvidenceRef;
};

function orgId() {
  return getOrgId();
}

export const protoApi = {
  async health() {
    // no org header required
    return apiRequest<{ status: string; environment?: string; timestamp?: string }>("/health");
  },

  async getOverview(period?: string) {
    const q = period ? `?period=${encodeURIComponent(period)}` : "";
    return apiRequest<ProtoOverview>(`/prototype/overview${q}`, { orgId: orgId() });
  },

  async getObligations(period?: string) {
    const q = period ? `?period=${encodeURIComponent(period)}` : "";
    return apiRequest<ProtoObligation[]>(`/prototype/obligations${q}`, { orgId: orgId() });
  },

  async getBankFeed(period?: string) {
    const q = period ? `?period=${encodeURIComponent(period)}` : "";
    return apiRequest<any>(`/prototype/feeds/bank${q}`, { orgId: orgId() });
  },

  async getPayrollFeed(period?: string) {
    const q = period ? `?period=${encodeURIComponent(period)}` : "";
    return apiRequest<any>(`/prototype/feeds/payroll${q}`, { orgId: orgId() });
  },

  async lodgeBAS(body: LodgeBASRequest) {
    return apiRequest<LodgeBASResponse>("/prototype/lodgments/bas", {
      method: "POST",
      orgId: orgId(),
      body,
    });
  },

  async generateEvidencePack(body: GenerateEvidencePackRequest) {
    return apiRequest<GenerateEvidencePackResponse>("/prototype/evidence-pack/generate", {
      method: "POST",
      orgId: orgId(),
      body,
    });
  },

  async createPaymentPlan(body: PaymentPlanRequest) {
    return apiRequest<PaymentPlanResponse>("/prototype/payment-plan", {
      method: "POST",
      orgId: orgId(),
      body,
    });
  },

  async computePaygw(input: PaygwInput): Promise<ProtoTaxObligation[]> {
    const asAt = input.asAt ?? new Date().toISOString().slice(0, 10);
    return (await computeTax("AU_PAYGW", { asAt, orgId: orgId() }, input)) as ProtoTaxObligation[];
  },

  async computeGst(input: GstInput): Promise<ProtoTaxObligation[]> {
    const asAt = input.asAt ?? new Date().toISOString().slice(0, 10);
    return (await computeTax("AU_GST", { asAt, orgId: orgId() }, input)) as ProtoTaxObligation[];
  },

  // Optional helper for Regulator Portal (page falls back if this fails)
  async getRegulatorSummary() {
    return apiRequest<any>("/regulator/compliance/summary", { orgId: orgId() });
  },
};
