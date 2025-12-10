// services/api-gateway/src/schemas/period.ts

// YYYY-Qn or YYYY-MM
export const PERIOD_REGEX = /^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/;

export function normalizePeriod(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("period_required");
  }
  if (!PERIOD_REGEX.test(trimmed)) {
    throw new Error("invalid_period");
  }
  return trimmed;
}
