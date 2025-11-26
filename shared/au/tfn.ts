const TFN_8_WEIGHTS = [10, 7, 8, 4, 6, 3, 5, 2] as const;
const TFN_9_WEIGHTS = [1, 4, 7, 10, 3, 5, 8, 11, 2] as const;

const DIGIT_ONLY = /\d+/g;

export function normalizeTfn(input: string): string {
  const digits = input.match(DIGIT_ONLY)?.join("") ?? "";
  return digits;
}

export function isValidTFN(input: string): boolean {
  const normalized = normalizeTfn(input);
  if (!/^\d{8,9}$/.test(normalized)) {
    return false;
  }

  const weights = normalized.length === 8 ? TFN_8_WEIGHTS : TFN_9_WEIGHTS;
  const weightedSum = normalized
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);

  return weightedSum % 11 === 0;
}





































