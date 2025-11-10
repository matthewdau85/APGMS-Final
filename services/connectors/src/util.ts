export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ensurePositive(value: number): number {
  return roundCurrency(Math.max(0, value));
}
