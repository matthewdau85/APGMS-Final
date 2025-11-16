import { BasePayToProvider } from "./base.js";
import type {
  PayToMandateRequest,
  PayToMandateResult,
  PayToProviderDependencies,
  PayToProviderOptions,
} from "./types.js";

export class NabPayToProvider extends BasePayToProvider {
  constructor(
    options: PayToProviderOptions = { id: "nab" },
    deps?: PayToProviderDependencies,
  ) {
    super(
      {
        id: "nab",
        baseUrl: options.baseUrl ?? "https://api.nab.com.au/payto/",
        credentialSecret: options.credentialSecret,
        timeoutMs: options.timeoutMs,
      },
      deps,
    );
  }

  async initiateMandate(
    request: PayToMandateRequest,
  ): Promise<PayToMandateResult> {
    this.logMandateAttempt(request);
    const payload = {
      debtor: {
        name: request.accountName,
        bsb: request.bsb,
        accountNumber: request.accountNumber,
      },
      amount: request.amountCents / 100,
      reference: request.reference,
      description: request.description,
      contactEmail: request.contactEmail,
    };

    const response = await this.post<PayToMandateResult>(
      "/mandates",
      payload,
    );

    return { ...response, provider: this.id };
  }
}
