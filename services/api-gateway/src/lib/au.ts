const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;
const TFN_8_WEIGHTS = [10, 7, 8, 4, 6, 3, 5, 2] as const;
const TFN_9_WEIGHTS = [1, 4, 7, 10, 3, 5, 8, 11, 2] as const;

const DIGIT_ONLY = /\d+/g;

export function normalizeAbn(input: string): string {
  return input.match(DIGIT_ONLY)?.join("") ?? "";
}

export function isValidABN(input: string): boolean {
  const normalized = normalizeAbn(input);
  if (normalized.length !== 11 || !/^\d{11}$/.test(normalized)) {
    return false;
  }

  const digits = normalized
    .split("")
    .map((char, index) => (index === 0 ? Number(char) - 1 : Number(char)));

  const weightedSum = digits.reduce(
    (sum, digit, index) => sum + digit * ABN_WEIGHTS[index]!,
    0,
  );
  return weightedSum % 89 === 0;
}

export function normalizeTfn(input: string): string {
  return input.match(DIGIT_ONLY)?.join("") ?? "";
}

export function isValidTFN(input: string): boolean {
  const normalized = normalizeTfn(input);
  if (!/^\d{8,9}$/.test(normalized)) {
    return false;
  }

  const weights = normalized.length === 8 ? TFN_8_WEIGHTS : TFN_9_WEIGHTS;
  const weightedSum = normalized
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * weights[index]!, 0);

  return weightedSum % 11 === 0;
}
