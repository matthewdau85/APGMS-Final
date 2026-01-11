export type IsoDateTime = string;

export interface RegulatorLoginInput {
  orgId: string;
  accessCode: string;
}

export interface RegulatorLoginResult {
  token: string;
  expiresAt: IsoDateTime;
}

/**
 * Session stored client-side for regulator UI.
 * Keep fields expected by existing pages (orgId, token, expiresAt).
 */
export interface RegulatorSession {
  orgId: string;
  token: string;
  expiresAt: IsoDateTime;
}

const SESSION_KEY = "apgms.regulator.session";

const DEFAULT_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.toString?.() ?? "";

/**
 * Logs in and returns a token + expiry.
 * Note: orgId is not returned by backend; we persist it locally in session.
 */
export async function regulatorLogin(
  input: RegulatorLoginInput
): Promise<RegulatorLoginResult> {
  return apiRequest<RegulatorLoginResult>("/api/regulator/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getRegulatorSession(): RegulatorSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RegulatorSession>;
    if (!parsed) return null;

    // Back-compat: older sessions may not have orgId.
    const orgId = typeof parsed.orgId === "string" ? parsed.orgId : "";

    if (typeof parsed.token !== "string" || !parsed.token) return null;
    if (typeof parsed.expiresAt !== "string" || !parsed.expiresAt) return null;

    return { orgId, token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

/**
 * Convenience used by existing pages.
 */
export function getRegulatorToken(): string | null {
  const s = getRegulatorSession();
  return s?.token ?? null;
}

export function setRegulatorSession(session: RegulatorSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearRegulatorSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function isRegulatorAuthenticated(now: Date = new Date()): boolean {
  const s = getRegulatorSession();
  if (!s) return false;

  const exp = Date.parse(s.expiresAt);
  if (!Number.isFinite(exp)) return false;

  return now.getTime() < exp;
}

export function withRegulatorAuth(init?: RequestInit): RequestInit {
  const token = getRegulatorToken();
  if (!token) return init ?? {};

  return {
    ...(init ?? {}),
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
  };
}

/* -----------------------------
   Typed request helper
------------------------------ */

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinUrl(DEFAULT_BASE_URL, path);

  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await safeReadText(res);
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}

function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  const b = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
