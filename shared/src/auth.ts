const DEFAULT_SALT_ROUNDS = 12;

type BcryptModule = {
  hash: (password: string, saltRounds: number) => Promise<string>;
  compare: (candidate: string, hash: string) => Promise<boolean>;
};

let bcryptLoader: Promise<BcryptModule> | undefined;

async function loadBcrypt(): Promise<BcryptModule> {
  if (!bcryptLoader) {
    bcryptLoader = (async () => {
      try {
        const mod = await import("bcryptjs");
        return ((mod as any).default ?? mod) as BcryptModule;
      } catch {
        const mod = await import("./stubs/bcrypt");
        return mod as unknown as BcryptModule;
      }
    })();
  }
  return bcryptLoader;
}

/** Hashes a password using bcrypt with a reasonable work factor. */
export async function hashPassword(password: string, saltRounds = DEFAULT_SALT_ROUNDS): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("password must be at least 8 characters long");
  }
  const bcrypt = await loadBcrypt();
  return bcrypt.hash(password, saltRounds);
}

/** Verifies a candidate password against a stored bcrypt hash. */
export async function verifyPassword(candidate: string, hash: string): Promise<boolean> {
  if (!candidate || !hash) {
    return false;
  }
  const bcrypt = await loadBcrypt();
  return bcrypt.compare(candidate, hash);
}

/**
 * Masks an email address by preserving the first and last characters of the local part
 * and leaving the domain visible. Short local parts fall back to a generic mask.
 */
export function maskEmail(email: string): string {
  if (!email) {
    return "***redacted***";
  }
  const [localPart, domain] = email.split("@");
  if (!domain) {
    return "***redacted***";
  }
  const trimmedLocal = localPart.trim();
  if (trimmedLocal.length === 0) {
    return `***@${domain}`;
  }
  if (trimmedLocal.length === 1) {
    return `${trimmedLocal}${"*".repeat(3)}@${domain}`;
  }
  const first = trimmedLocal[0];
  const last = trimmedLocal[trimmedLocal.length - 1];
  const middle = "*".repeat(Math.max(3, trimmedLocal.length - 2));
  return `${first}${middle}${last}@${domain}`;
}
