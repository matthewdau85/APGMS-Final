export function ensureNumber(raw: string, fallback: number): number {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}
