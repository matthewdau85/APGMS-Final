import { authenticator } from "otplib";

authenticator.options = {
  step: 30,
  window: 1,
};

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function generateTotpToken(secret: string): string {
  return authenticator.generate(secret);
}

export function verifyTotpToken(secret: string, token: string): boolean {
  return authenticator.verify({ token, secret });
}

export function buildTotpUri(
  secret: string,
  label: string,
  issuer: string,
): string {
  return authenticator.keyuri(label, issuer, secret);
}
