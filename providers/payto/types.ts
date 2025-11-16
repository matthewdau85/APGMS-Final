import type { SecretManager } from "@apgms/shared/security/secret-manager";

export type PayToMandateRequest = {
  orgId: string;
  accountName: string;
  bsb: string;
  accountNumber: string;
  amountCents: number;
  description: string;
  reference: string;
  contactEmail?: string;
};

export type PayToMandateResult = {
  provider: string;
  mandateId: string;
  status: string;
  submittedAt: string;
  reference: string;
};

export interface PayToProvider {
  readonly id: string;
  initiateMandate(request: PayToMandateRequest): Promise<PayToMandateResult>;
}

export type PayToProviderOptions = {
  id: string;
  baseUrl?: string;
  credentialSecret?: string;
  timeoutMs?: number;
};

export type PayToProviderDependencies = {
  fetch?: typeof fetch;
  secretManager?: SecretManager;
};
