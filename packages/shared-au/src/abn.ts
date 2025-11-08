const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;

function normalise(value: string): string {
  return value.replace(/\s+/g, "");
}

function hasValidCharacters(value: string): boolean {
  return /^\d{11}$/.test(value);
}

export function isValidABN(input: string): boolean {
  const value = normalise(input);
  if (!hasValidCharacters(value)) {
    return false;
  }

  const digits = value.split("").map((digit) => Number.parseInt(digit, 10));
  // Subtract 1 from the first digit per ATO specification.
  digits[0] -= 1;

  const total = digits.reduce((sum, digit, index) => sum + digit * WEIGHTS[index], 0);
  return total % 89 === 0;
}

export default {
  isValidABN,
};
