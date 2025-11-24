// shared/src/ledger/index.ts
// Re-export the public ledger surface for other packages
export * from "./types.js";
export * as DesignatedAccountModule from "./designated-account.js";
export * from "./ingest.js";
export * from "./predictive.js";
/**
 * ---------------------------------------------------------------------------
 * Backwards-compatibility shims
 *
 * Older code (including @apgms/domain-policy) still imports
 * `evaluateDesignatedAccountPolicy` and `normalizeTransferSource` from
 * `@apgms/shared/ledger`. Those symbols used to live here but the design
 * moved on.
 *
 * To avoid breaking those imports while we refactor, we provide very
 * permissive "shim" exports:
 *  - `normalizeTransferSource` – identity function
 *  - `evaluateDesignatedAccountPolicy` – async stub that throws if called
 *
 * TypeScript is happy because the symbols exist and accept any parameters;
 * at runtime you should *not* be calling these – domain policy should own
 * the real implementations.
 * ---------------------------------------------------------------------------
 */
/**
 * Normalises a transfer source string.
 *
 * Shim implementation: currently a no-op identity function so existing code
 * that still calls it will continue to behave as before, just without extra
 * normalisation.
 */
export function normalizeTransferSource(source) {
    return source;
}
/**
 * Evaluates a designated account policy.
 *
 * Shim implementation: this should never be hit in production. If it is,
 * it will throw loudly so we find and fix the remaining legacy call sites.
 */
export async function evaluateDesignatedAccountPolicy(..._args) {
    throw new Error("evaluateDesignatedAccountPolicy shim in @apgms/shared/ledger was called. " +
        "This logic has moved; imports should be updated to use @apgms/domain-policy directly.");
}
