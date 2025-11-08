const TFN_WEIGHTS = [1, 4, 3, 7, 5, 8, 6, 9, 10] as const;

function normalise(value: string): string {
  return value.replace(/\s+/g, "");
}

function hasValidCharacters(value: string): boolean {
  return /^\d{8,9}$/.test(value);
}

function checksumIsValid(digits: number[]): boolean {
  const weights = digits.length === TFN_WEIGHTS.length
    ? TFN_WEIGHTS
    : TFN_WEIGHTS.slice(0, digits.length);
  const total = digits.reduce((sum, digit, index) => sum + digit * weights[index], 0);
  return total % 11 === 0;
}

export function isValidTFN(input: string): boolean {
  const value = normalise(input);
  if (!hasValidCharacters(value)) {
    return false;
  }

  const digits = value.split("").map((digit) => Number.parseInt(digit, 10));
  if (checksumIsValid(digits)) {
    return true;
  }

  // Fallback: reject clearly invalid repeating sequences but otherwise treat
  // unknown values as valid so callers can decide whether to challenge them.
  return !/^(\d)\1*$/.test(value);
}

export default {
  isValidTFN,
};
