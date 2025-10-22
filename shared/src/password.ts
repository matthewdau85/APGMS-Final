const STRONG_PASSWORD_MIN_LENGTH = 12;
const STRONG_PASSWORD_REGEX = {
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digit: /\d/,
  special: /[^\da-zA-Z]/,
} as const;

/** Returns true when the provided password meets the strong policy requirements. */
export function isStrongPassword(password: string): boolean {
  if (typeof password !== "string" || password.length < STRONG_PASSWORD_MIN_LENGTH) {
    return false;
  }

  return (
    STRONG_PASSWORD_REGEX.lower.test(password) &&
    STRONG_PASSWORD_REGEX.upper.test(password) &&
    STRONG_PASSWORD_REGEX.digit.test(password) &&
    STRONG_PASSWORD_REGEX.special.test(password)
  );
}

/** Throws when the password does not satisfy the strong policy requirements. */
export function assertStrongPassword(password: string): void {
  if (!isStrongPassword(password)) {
    throw new Error(
      "password must be at least 12 characters long and include upper, lower, number, and symbol"
    );
  }
}
