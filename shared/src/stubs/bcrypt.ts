import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";
const PREFIX = "stub$";

export async function hash(password: string, saltRounds?: number): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${PREFIX}${salt}$${derived}`;
}

export async function compare(candidate: string, hashed: string): Promise<boolean> {
  if (!hashed.startsWith(PREFIX)) {
    return false;
  }
  const [, salt, digest] = hashed.split("$");
  if (!salt || !digest) {
    return false;
  }
  const derived = pbkdf2Sync(candidate, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(digest, "hex"));
}
