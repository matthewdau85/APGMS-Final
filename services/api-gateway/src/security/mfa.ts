import { verifyTotpToken } from "@apgms/shared";
import {
  getTotpCredential,
  hashRecoveryCode,
  recordMfaUsage,
  updateTotpRecoveryCodes,
} from "../lib/mfa-store.js";

const SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

type ActiveSession = {
  expiresAt: number;
};

const activeSessions = new Map<string, ActiveSession>();

const now = () => Date.now();

const cleanup = () => {
  const timestamp = now();
  for (const [userId, details] of activeSessions.entries()) {
    if (details.expiresAt <= timestamp) {
      activeSessions.delete(userId);
    }
  }
};

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
  activeSessions.delete(userId);
}

export function grantStepUpSession(
  userId: string,
  ttlMs: number = SESSION_EXPIRY_MS,
): Date {
  const expiry = now() + ttlMs;
  activeSessions.set(userId, {
    expiresAt: expiry,
  });
  return new Date(expiry);
}

function normaliseRecoveryCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export type VerifyChallengeResult = {
  success: boolean;
  method?: "totp" | "recovery";
  expiresAt?: Date;
  remainingRecoveryCodes?: number;
};

export async function verifyChallenge(userId: string, code: string): Promise<VerifyChallengeResult> {
  cleanup();
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { success: false };
  }

  const credential = await getTotpCredential(userId);
  if (!credential) {
    return { success: false };
  }

  const numericToken = trimmed.replace(/\s+/g, "");
  if (/^\d{6}$/.test(numericToken) && verifyTotpToken(credential.secret, numericToken)) {
    await recordMfaUsage(credential.record.id);
    const expiresAt = grantStepUpSession(userId);
    return {
      success: true,
      method: "totp",
      expiresAt,
      remainingRecoveryCodes: credential.recoveryCodes.filter((entry) => !entry.used).length,
    };
  }

  const hashed = hashRecoveryCode(normaliseRecoveryCode(trimmed));
  const index = credential.recoveryCodes.findIndex(
    (entry) => entry.hash === hashed && !entry.used,
  );

  if (index === -1) {
    return { success: false };
  }

  const updatedRecoveryCodes = credential.recoveryCodes.map((entry, idx) =>
    idx === index ? { ...entry, used: true } : entry,
  );

  await updateTotpRecoveryCodes(
    credential.record.id,
    userId,
    credential.secret,
    updatedRecoveryCodes,
  );
  await recordMfaUsage(credential.record.id);
  const expiresAt = grantStepUpSession(userId);
  return {
    success: true,
    method: "recovery",
    expiresAt,
    remainingRecoveryCodes: updatedRecoveryCodes.filter((entry) => !entry.used).length,
  };
}
