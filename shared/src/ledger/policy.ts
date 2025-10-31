import {
  DESIGNATED_TRANSFER_SOURCES,
  type DesignatedAccountPolicyInput,
  type DesignatedAccountPolicyResult,
  type DesignatedTransferSource,
} from "./types.js";

const allowedSources = new Set<string>(DESIGNATED_TRANSFER_SOURCES);

export function normalizeTransferSource(
  source: string,
): DesignatedTransferSource | null {
  const upper = source.toUpperCase();
  return allowedSources.has(upper) ? (upper as DesignatedTransferSource) : null;
}

export function evaluateDesignatedAccountPolicy(
  input: DesignatedAccountPolicyInput,
): DesignatedAccountPolicyResult {
  if (!Number.isFinite(input.amount)) {
    return {
      allowed: false,
      violation: {
        code: "designated_invalid_amount",
        message: "Transfer amount must be a finite number",
        severity: "MEDIUM",
      },
    };
  }

  if (input.amount <= 0) {
    return {
      allowed: false,
      violation: {
        code: "designated_withdrawal_attempt",
        message: "Designated accounts are deposit-only; debits are prohibited",
        severity: "HIGH",
      },
    };
  }

  const normalized = normalizeTransferSource(input.source);
  if (!normalized) {
    return {
      allowed: false,
      violation: {
        code: "designated_untrusted_source",
        message: `Designated account funding source '${input.source}' is not whitelisted`,
        severity: "HIGH",
      },
    };
  }

  return { allowed: true };
}

