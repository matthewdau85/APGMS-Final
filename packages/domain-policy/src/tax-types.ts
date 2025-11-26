/**
 * packages/domain-policy/src/tax-types.ts
 *
 * Canonical tax obligation / jurisdiction type definitions for APGMS.
 * This is the single source of truth for tax type identifiers.
 */

// ---------------------------------------------------------------------------
// Tax obligations (PAYGW, GST, PAYGI, etc.)
// ---------------------------------------------------------------------------

// Runtime value object (stable string keys)
export const TaxObligation = {
  PAYGW: "PAYGW",       // Pay As You Go Withholding
  GST: "GST",           // Goods and Services Tax
  PAYGI: "PAYGI",       // Pay As You Go Instalments
  FBT: "FBT",           // Fringe Benefits Tax
  LCT: "LCT",           // Luxury Car Tax
  WET: "WET",           // Wine Equalisation Tax
  COMPANY: "COMPANY",   // Company Income Tax
} as const;

// Type: union of the values above
export type TaxObligationType = typeof TaxObligation[keyof typeof TaxObligation];

// Runtime guard
export function isTaxObligation(value: string): value is TaxObligationType {
  return Object.values(TaxObligation).includes(value as TaxObligationType);
}

// ---------------------------------------------------------------------------
// Jurisdiction codes (AU-only for now, but future-proofed)
// ---------------------------------------------------------------------------

/**
 * ISO-style jurisdiction code for tax configuration.
 * APGMS is AU-only for now, but this is defined here so AU-tax code,
 * ledger, and other domains can share the same type.
 */
export type JurisdictionCode = "AU";

/**
 * Simple runtime guard for jurisdiction codes.
 */
export function isJurisdictionCode(value: string): value is JurisdictionCode {
  return value === "AU";
}
