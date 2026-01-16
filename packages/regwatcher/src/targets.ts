import type { Target } from "./types.js";

/**
 * Seed targets. Edit freely — keep it small/high-signal to start.
 * Use pages that announce legislative/guidance changes or “What’s new”.
 */
export const TARGETS: Target[] = [
  // ATO “What’s new” (news and updates)
  { id: "ato-whats-new", url: "https://www.ato.gov.au/General/Whats-new/", frequencyHours: 6 },

  // ATO PAYG withholding tax tables landing (periodically updated)
  { id: "ato-paygw-tables", url: "https://www.ato.gov.au/rates/tax-tables", frequencyHours: 24 },

  // ATO Practical Compliance Guidelines overview index
  { id: "ato-pcg-index", url: "https://www.ato.gov.au/law/practical-compliance-guidelines", frequencyHours: 24 },

  // ATO Legal Database – public rulings index
  { id: "ato-public-rulings", url: "https://www.ato.gov.au/law/list?docid=law/public-rulings", frequencyHours: 24 }
];

/**
 * IMPORTANT: update these to the exact pages you rely on.
 * For the Legal Database, you may prefer the dedicated “What’s new” feeds
 * specific to rulings/instruments you track for PAYGW/GST.
 */
