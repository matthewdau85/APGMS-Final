// services/api-gateway/src/lib/safe-math.ts
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function toInt(n: unknown, fallback = 0): number {
  if (typeof n === "number" && Number.isFinite(n)) return Math.trunc(n);
  if (typeof n === "string") {
    const parsed = Number(n);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

export function safeDivide(numerator: number, denominator: number, denomZeroFallback = 1): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  if (denominator === 0) return denomZeroFallback;
  return numerator / denominator;
}

export function stableId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
}
