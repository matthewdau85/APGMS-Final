import { randomUUID } from "node:crypto";

import type { PayToMandateRequest, PayToMandateResult, PayToProvider } from "./types.js";

export class MockPayToProvider implements PayToProvider {
  readonly id = "mock";

  async initiateMandate(request: PayToMandateRequest): Promise<PayToMandateResult> {
    return {
      provider: this.id,
      mandateId: `mock-${randomUUID()}`,
      status: "verified",
      submittedAt: new Date().toISOString(),
      reference: request.reference,
    };
  }
}
