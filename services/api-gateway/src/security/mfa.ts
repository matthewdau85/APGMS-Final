const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

type PendingChallenge = {
  code: string;
  expiresAt: number;
};

type ActiveSession = {
  expiresAt: number;
};

const pendingChallenges = new Map<string, PendingChallenge>();
const activeSessions = new Map<string, ActiveSession>();

const generateCode = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const now = () => Date.now();

const cleanup = () => {
  const timestamp = now();
  for (const [userId, details] of pendingChallenges.entries()) {
    if (details.expiresAt <= timestamp) {
      pendingChallenges.delete(userId);
    }
  }
  for (const [userId, details] of activeSessions.entries()) {
    if (details.expiresAt <= timestamp) {
      activeSessions.delete(userId);
    }
  }
};

export function createChallenge(userId: string): string {
  cleanup();
  const code = generateCode();
  pendingChallenges.set(userId, {
    code,
    expiresAt: now() + CODE_EXPIRY_MS,
  });
  activeSessions.delete(userId);
  return code;
}

export function verifyChallenge(userId: string, code: string): boolean {
  cleanup();
  const record = pendingChallenges.get(userId);
  if (!record || record.code !== code) {
    return false;
  }
  pendingChallenges.delete(userId);
  activeSessions.set(userId, {
    expiresAt: now() + SESSION_EXPIRY_MS,
  });
  return true;
}

export function requireRecentVerification(userId: string): boolean {
  cleanup();
  const record = activeSessions.get(userId);
  if (!record) {
    return false;
  }
  if (record.expiresAt <= now()) {
    activeSessions.delete(userId);
    return false;
  }
  return true;
}

export function clearVerification(userId: string): void {
  pendingChallenges.delete(userId);
  activeSessions.delete(userId);
}
