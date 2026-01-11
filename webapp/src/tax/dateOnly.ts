function assertDateOnlyFormat(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid date-only format");
  }
}

export function parseDateOnlyUtc(date: string): number {
  assertDateOnlyFormat(date);
  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error("Invalid date-only format");
  }
  if (month < 1 || month > 12) {
    throw new Error("Invalid date-only format");
  }
  if (day < 1 || day > 31) {
    throw new Error("Invalid date-only format");
  }

  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("Invalid date-only format");
  }

  return ms;
}

export function isWithinEffectiveRange(
  asAt: string,
  effectiveFrom: string,
  effectiveTo?: string | null
): boolean {
  const asAtMs = parseDateOnlyUtc(asAt);
  const fromMs = parseDateOnlyUtc(effectiveFrom);
  if (asAtMs < fromMs) return false;

  if (effectiveTo == null) return true;
  const toMs = parseDateOnlyUtc(effectiveTo);
  return asAtMs < toMs;
}
