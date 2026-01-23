// services/api-gateway/src/lib/password.ts
import crypto from "node:crypto";

export type PasswordHash = {
  scheme: "pbkdf2";
  iter: number;
  salt_b64: string;
  hash_b64: string;
};

const DEFAULT_ITER = 210_000;
const KEYLEN = 32;
const DIGEST = "sha256";

function b64(buf: Buffer): string {
  return buf.toString("base64");
}

function fromB64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const iter = Number(process.env.APGMS_PBKDF2_ITER || DEFAULT_ITER);

  const derived = crypto.pbkdf2Sync(password, salt, iter, KEYLEN, DIGEST);

  const obj: PasswordHash = {
    scheme: "pbkdf2",
    iter,
    salt_b64: b64(salt),
    hash_b64: b64(derived),
  };

  return JSON.stringify(obj);
}

export function verifyPassword(password: string, stored: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return false;
  }

  if (!parsed || typeof parsed !== "object") return false;

  const p = parsed as Partial<PasswordHash>;
  if (p.scheme !== "pbkdf2") return false;
  if (!p.iter || typeof p.iter !== "number") return false;
  if (!p.salt_b64 || typeof p.salt_b64 !== "string") return false;
  if (!p.hash_b64 || typeof p.hash_b64 !== "string") return false;

  const salt = fromB64(p.salt_b64);
  const expected = fromB64(p.hash_b64);
  const actual = crypto.pbkdf2Sync(password, salt, p.iter, expected.length, DIGEST);

  return crypto.timingSafeEqual(expected, actual);
}
