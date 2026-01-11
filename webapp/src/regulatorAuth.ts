import { apiRequest } from "./lib/api-client";

const STORAGE_KEY = "apgms:regulator:session";

export type RegulatorSession = {
  accessToken: string;
  orgId: string;
  expiresAtEpochMs: number;
};

export type RegulatorLoginInput = {
  // What your page is currently passing:
  accessCode: string;
  orgId: string;

  // Optional: allow other naming if you later refactor UI/back-end
  code?: string;
};

function nowMs(): number {
  return Date.now();
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function saveRegulatorSession(session: RegulatorSession): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearRegulatorSession(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getRegulatorSession(): RegulatorSession | null {
  if (!hasWindow()) return null;

  const s = safeJsonParse<RegulatorSession>(window.localStorage.getItem(STORAGE_KEY));
  if (!s) return null;

  // Expired -> clear and return null
  if (typeof s.expiresAtEpochMs === "number" && s.expiresAtEpochMs <= nowMs()) {
    clearRegulatorSession();
    return null;
  }

  // Basic shape guard
  if (!s.accessToken || !s.orgId) return null;

  return s;
}

export function getRegulatorToken(): string | null {
  return getRegulatorSession()?.accessToken ?? null;
}

export function requireRegulatorToken(): string {
  const tok = getRegulatorToken();
  if (!tok) throw new Error("No regulator session. Please log in.");
  return tok;
}

/**
 * Overloads to stop the “Expected 1/2 arguments” churn:
 * - regulatorLogin({ accessCode, orgId })
 * - regulatorLogin(accessCode, orgId)
 */
export async function regulatorLogin(input: RegulatorLoginInput): Promise<RegulatorSession>;
export async function regulatorLogin(accessCode: string, orgId: string): Promise<RegulatorSession>;
export async function regulatorLogin(a: RegulatorLoginInput | string, b?: string): Promise<RegulatorSession> {
  const accessCode = typeof a === "string" ? a : (a.accessCode || a.code || "");
  const orgId = typeof a === "string" ? (b || "") : a.orgId;

  const cleanCode = (accessCode || "").trim();
  const cleanOrg = (orgId || "").trim();

  if (!cleanCode) throw new Error("Missing access code.");
  if (!cleanOrg) throw new Error("Missing orgId.");

  // Adjust the endpoint if your API uses a different path.
  // This is intentionally thin: it will throw if the endpoint is not implemented.
  const res = await apiRequest<{
    accessToken: string;
    expiresInSeconds?: number;
    orgId?: string;
  }>("/regulator/auth/login", {
    method: "POST",
    body: { accessCode: cleanCode, orgId: cleanOrg },
    orgId: cleanOrg,
  });

  const expiresIn = typeof res.expiresInSeconds === "number" ? res.expiresInSeconds : 30 * 60; // 30m default

  const session: RegulatorSession = {
    accessToken: res.accessToken,
    orgId: res.orgId ?? cleanOrg,
    expiresAtEpochMs: nowMs() + expiresIn * 1000,
  };

  saveRegulatorSession(session);
  return session;
}
