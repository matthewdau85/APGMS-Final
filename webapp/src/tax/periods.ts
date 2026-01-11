export type PayPeriod = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

const WEEKLY = new Set(["weekly", "week", "w", "wk", "wks"]);
const FORTNIGHTLY = new Set(["fortnightly", "fortnight", "fn", "f"]);
const MONTHLY = new Set(["monthly", "month", "m", "mo", "mn"]);

export function normalizePayPeriod(input: string): PayPeriod {
  const raw = input.trim();
  if (raw.length === 0) {
    throw new Error("Unknown pay period");
  }

  const upper = raw.toUpperCase();
  if (upper === "WEEKLY" || WEEKLY.has(raw.toLowerCase())) return "WEEKLY";
  if (upper === "FORTNIGHTLY" || FORTNIGHTLY.has(raw.toLowerCase())) return "FORTNIGHTLY";
  if (upper === "MONTHLY" || MONTHLY.has(raw.toLowerCase())) return "MONTHLY";

  throw new Error(`Unknown pay period: ${input}`);
}
