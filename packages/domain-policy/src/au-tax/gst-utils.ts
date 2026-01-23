export type GstLine = {
  amountCents?: number;
  amount?: number;
  category?: string;
  taxCategory?: string;
  taxCode?: string;
  classification?: string;
};

function asInt(n: unknown, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

export function getLineAmountCents(line: GstLine): number {
  return asInt(line.amountCents ?? line.amount ?? 0, 0);
}

/**
 * Classification resolution order:
 * 1) explicit line.classification (if present)
 * 2) config.classificationMap[line.category]
 * 3) fall back to line.taxCategory/taxCode/category as raw string
 */
export function getLineClassification(
  line: GstLine,
  config?: { classificationMap?: Record<string, string> } | null
): string {
  const explicit = norm(line.classification);
  if (explicit) return explicit;

  const key = String(line.category ?? "");
  const mapped = config?.classificationMap ? config.classificationMap[key] : undefined;
  const mappedNorm = norm(mapped);
  if (mappedNorm) return mappedNorm;

  const fallback = norm(line.taxCategory ?? line.taxCode ?? line.category ?? "taxable");
  return fallback;
}

export function isTaxableClassification(classification: string): boolean {
  const c = norm(classification);

  // Accept both underscore and hyphen conventions and common synonyms.
  if (c === "gst_free" || c === "gst-free" || c === "gstfree") return false;
  if (c === "input_taxed" || c === "input-taxed" || c === "inputtaxed") return false;
  if (c === "exempt") return false;

  // Default: taxable
  return true;
}

export function calcGstForCents(amountCents: number, rateMilli: number): number {
  const amt = asInt(amountCents, 0);
  const rate = asInt(rateMilli, 0);
  return Math.round((amt * rate) / 1000);
}

export function calcGstForLine(
  line: GstLine,
  rateMilli: number,
  config?: { classificationMap?: Record<string, string> } | null
): number {
  const amt = getLineAmountCents(line);
  if (amt === 0) return 0;

  const cls = getLineClassification(line, config);
  if (!isTaxableClassification(cls)) return 0;

  return calcGstForCents(amt, rateMilli);
}

export function sumGstForLines(
  lines: GstLine[] | undefined,
  rateMilli: number,
  config?: { classificationMap?: Record<string, string> } | null
): number {
  const arr = Array.isArray(lines) ? lines : [];
  let total = 0;
  for (const line of arr) total += calcGstForLine(line, rateMilli, config);
  return total;
}
