const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;

const DIGIT_ONLY = /\d+/g;

export function normalizeAbn(input: string): string {
  const digits = input.match(DIGIT_ONLY)?.join("") ?? "";
  return digits;
}

export function isValidABN(input: string): boolean {
  const normalized = normalizeAbn(input);
  if (normalized.length !== 11) {
    return false;
  }

  if (!/^\d{11}$/.test(normalized)) {
    return false;
  }

  const digits = normalized
    .split("")
    .map((char, index) => {
      const value = Number(char);
      return index === 0 ? value - 1 : value;
    });

  const weightedSum = digits.reduce((sum, digit, index) => sum + digit * ABN_WEIGHTS[index], 0);
  return weightedSum % 89 === 0;
}





































