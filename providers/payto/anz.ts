import { BasePayToProvider } from "./base.js";
import type {
  PayToMandateRequest,
  PayToMandateResult,
  PayToProviderDependencies,
  PayToProviderOptions,
} from "./types.js";

export class AnzPayToProvider extends BasePayToProvider {
  constructor(
    options: PayToProviderOptions = { id: "anz" },
    deps?: PayToProviderDependencies,
  ) {
    super(
      {
        id: "anz",
        baseUrl: options.baseUrl ?? "https://api.anz.com/payto/v1/",
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
      debtorAccount: {
        holderName: request.accountName,
        bsb: request.bsb,
        number: request.accountNumber,
      },
      limits: {
        maxAmount: request.amountCents / 100,
      },
      metadata: {
        description: request.description,
        reference: request.reference,
        contactEmail: request.contactEmail,
      },
    };

    const response = await this.post<PayToMandateResult>(
      "/agreements",
      payload,
    );

    return { ...response, provider: this.id };
  }
}
