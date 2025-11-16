// services/api-gateway/src/lib/ato.ts
// Stubbed ATO/ABR lookup. Replace with real integration later.

import { withRetry } from "./retry.js";

export type Obligation = "PAYGW" | "GST" | "PAYGI";

export interface AbnTfnValidationResult {
  valid: boolean;
  obligations: Obligation[];
}

/**
 * Validate ABN/TFN and return which obligations the entity is registered for.
 * In production, replace this with real ABR/ATO calls.
 */
export async function validateAbnTfn(
  abn: string,
  tfn: string,
): Promise<AbnTfnValidationResult> {
  return withRetry(async () => {
    if (!abn || !tfn) {
      return { valid: false, obligations: [] };
    }

    return {
      valid: true,
      obligations: ["PAYGW", "GST"],
    };
  });
}
