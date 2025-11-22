// Thin wrapper so routes can import a stable function name.
// Swap implementation here when you wire up real ABR/ATO integration.

import {
  validateAbnOrTfnStub,
  type AbnTfnLookupResult,
} from "../services/abr-stub.js";

export async function validateAbnTfn(
  abn?: string,
  tfn?: string,
): Promise<AbnTfnLookupResult> {
  return validateAbnOrTfnStub({ abn, tfn });
}

export type { AbnTfnLookupResult };
