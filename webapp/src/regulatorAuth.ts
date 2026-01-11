const STORAGE_KEY = "apgms.regulatorSession.v1";

export type RegulatorSession = {
  token: string;
  email: string;
  expiresAt: number; // epoch ms
  orgId?: string;
};

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore (storage may be blocked)
  }
}

function safeRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function isValidSession(x: unknown): x is RegulatorSession {
  if (!x || typeof x !== "object") return false;
  const s = x as RegulatorSession;
  return (
    typeof s.token === "string" &&
    s.token.length > 0 &&
    typeof s.email === "string" &&
    s.email.length > 0 &&
    typeof s.expiresAt === "number" &&
    Number.isFinite(s.expiresAt)
  );
}

export function getRegulatorSession(): RegulatorSession | null {
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidSession(parsed)) return null;

    if (parsed.expiresAt <= Date.now()) {
      safeRemoveItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Compatibility alias. Prefer saveRegulatorSession().
 */
export function setRegulatorSession(session: RegulatorSession): void {
  saveRegulatorSession(session);
}

/**
 * Save the session (single-arg) to match RegulatorLoginPage usage.
 */
export function saveRegulatorSession(session: RegulatorSession): void {
  safeSetItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearRegulatorSession(): void {
  safeRemoveItem(STORAGE_KEY);
}

/**
 * Convenience helper used by regulator pages that call APIs.
 */
export function getRegulatorToken(): string | null {
  return getRegulatorSession()?.token ?? null;
}
