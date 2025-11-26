import type { FastifyBaseLogger } from "fastify";

export type PayToCreateMandateInput = {
  orgId: string;
  bsb: string;
  accountNumber: string;
  accountName: string;
};

export type PayToMandate = {
  mandateId: string;
  status: "PENDING" | "ACTIVE" | "FAILED";
};

export interface PayToProvider {
  createMandate(input: PayToCreateMandateInput): Promise<PayToMandate>;
  cancelMandate(mandateId: string): Promise<void>;
}

// Simple in-process stub providers. Replace with real bank APIs later.
class BaseStubPayToProvider implements PayToProvider {
  constructor(
    private readonly bankCode: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  async createMandate(input: PayToCreateMandateInput): Promise<PayToMandate> {
    const mandateId = `${this.bankCode}-${input.orgId}-${Date.now()}`;
    this.log.info(
      {
        bank: this.bankCode,
        orgId: input.orgId,
        bsb: input.bsb,
        accountNumber: input.accountNumber,
      },
      "payto_stub_create_mandate",
    );
    return { mandateId, status: "PENDING" };
  }

  async cancelMandate(mandateId: string): Promise<void> {
    this.log.info(
      { bank: this.bankCode, mandateId },
      "payto_stub_cancel_mandate",
    );
  }
}

let cachedProviders: Record<string, PayToProvider> | null = null;

export function initPayToProviders(
  log: FastifyBaseLogger,
): Record<string, PayToProvider> {
  if (cachedProviders) return cachedProviders;

  cachedProviders = {
    cba: new BaseStubPayToProvider("cba", log),
    nab: new BaseStubPayToProvider("nab", log),
    anz: new BaseStubPayToProvider("anz", log),
  };

  return cachedProviders;
}

export function getPayToProvider(
  bankCode: "cba" | "nab" | "anz",
): PayToProvider {
  if (!cachedProviders) {
    throw new Error("payto_providers_not_initialised");
  }
  const provider = cachedProviders[bankCode];
  if (!provider) {
    throw new Error(`payto_provider_unsupported_${bankCode}`);
  }
  return provider;
}
