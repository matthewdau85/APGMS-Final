import argon2 from "argon2";

const DEFAULT_MEMORY_COST = Number(process.env.PASSWORD_MEM_KIB ?? "65536");
const DEFAULT_TIME_COST = Number(process.env.PASSWORD_TIME_COST ?? "3");
const DEFAULT_PARALLELISM = Number(process.env.PASSWORD_PARALLELISM ?? "1");

const pepper = process.env.PASSWORD_PEPPER ?? "";

const argon2Options: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: DEFAULT_MEMORY_COST,
  timeCost: DEFAULT_TIME_COST,
  parallelism: DEFAULT_PARALLELISM,
};

function applyPepper(password: string): string {
  return pepper ? `${password}.${pepper}` : password;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(applyPepper(password), argon2Options);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, applyPepper(password), argon2Options);
  } catch {
    return false;
  }
}

