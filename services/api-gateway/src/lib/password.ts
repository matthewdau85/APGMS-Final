// services/api-gateway/src/lib/password.ts
import crypto from "node:crypto";

const KEY_LEN = 64;
const SALT_LEN = 16;

// Format: scrypt:<salt_b64>:<hash_b64>
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.scryptSync(password, salt, KEY_LEN);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const [algo, saltB64, hashB64] = parts;
  if (algo !== "scrypt") return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, salt, expected.length);

  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
