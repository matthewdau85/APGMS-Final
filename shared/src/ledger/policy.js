import { DESIGNATED_TRANSFER_SOURCES, } from "./types.js";
const allowedSources = new Set(DESIGNATED_TRANSFER_SOURCES);
export function normalizeTransferSource(source) {
    const upper = source.toUpperCase();
    return allowedSources.has(upper) ? upper : null;
}
export function evaluateDesignatedAccountPolicy(input) {
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
//# sourceMappingURL=policy.js.map