import { timingSafeEqual } from "node:crypto";

import argon2 from "argon2";

export const PASSWORD_VERSION = 1;
const ARGON2_OPTIONS = { type: argon2.argon2id } as const;
const HASH_PREFIX = "$argon2";

export function isArgon2Hash(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(HASH_PREFIX);
}

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length === 0) {
    throw new Error("password must not be empty");
  }
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPasswordHash(hash: string, plain: string): Promise<boolean> {
  if (!isArgon2Hash(hash)) {
    return false;
  }
  return argon2.verify(hash, plain, ARGON2_OPTIONS);
}

export interface UserPasswordRecord {
  password: string | null;
  passwordVersion: number | null;
}

export async function verifyUserPassword<
  T extends UserPasswordRecord,
>(
  record: T,
  plain: string,
  opts: {
    onUpgrade?: (params: { hash: string; version: number }) => Promise<void> | void;
  } = {},
): Promise<boolean> {
  if (!record.password) {
    return false;
  }

  if (isArgon2Hash(record.password)) {
    const isValid = await argon2.verify(record.password, plain, ARGON2_OPTIONS);
    if (!isValid) {
      return false;
    }
    if (record.passwordVersion !== PASSWORD_VERSION || argon2.needsRehash(record.password, ARGON2_OPTIONS)) {
      const hash = await hashPassword(plain);
      await opts.onUpgrade?.({ hash, version: PASSWORD_VERSION });
    }
    return true;
  }

  if (record.passwordVersion == null && typeof record.password === "string") {
    const legacy = Buffer.from(record.password, "utf8");
    const provided = Buffer.from(plain, "utf8");
    if (legacy.length !== provided.length) {
      return false;
    }
    if (!timingSafeEqual(legacy, provided)) {
      return false;
    }
    const hash = await hashPassword(plain);
    await opts.onUpgrade?.({ hash, version: PASSWORD_VERSION });
    return true;
  }

  return false;
}

export function markPasswordDeleted(): UserPasswordRecord {
  return { password: "__deleted__", passwordVersion: null };
}

export function argon2Options() {
  return { ...ARGON2_OPTIONS };
}
