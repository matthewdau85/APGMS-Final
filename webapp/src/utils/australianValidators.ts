const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;
const TFN_WEIGHTS = [1, 4, 3, 7, 5, 8, 6, 9, 10] as const;

const digitsOnly = (value: string): string => value.replace(/\s+/g, "").replace(/[^0-9]/g, "");

export function isValidAbn(input: string): boolean {
  const digits = digitsOnly(input);
  if (digits.length !== 11) {
    return false;
  }
  const normalized = [
    String(Number(digits[0]) - 1),
    ...digits.slice(1).split(""),
  ].join("");

  if (/[^0-9]/.test(normalized)) {
    return false;
  }

  const weightedSum = normalized
    .split("")
    .map((char, index) => Number(char) * ABN_WEIGHTS[index])
    .reduce((sum, value) => sum + value, 0);

  return weightedSum % 89 === 0;
}

export function isValidTfn(input: string): boolean {
  const digits = digitsOnly(input);
  if (digits.length < 8 || digits.length > 9) {
    return false;
  }
  if (digits.length === 8) {
    // TFN weights assume a leading zero for 8-digit TFNs
    return isValidTfn(`0${digits}`);
  }
  const sum = digits
    .split("")
    .map((char, index) => Number(char) * TFN_WEIGHTS[index])
    .reduce((acc, value) => acc + value, 0);

  return sum % 11 === 0;
}

export function maskTfn(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length === 0) {
    return "";
  }
  const masked = `${"***-***-"}${digits.slice(-3)}`;
  return masked;
}

export function formatAbn(input: string): string {
  const digits = digitsOnly(input);
  if (digits.length !== 11) {
    return digits;
  }
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}
