export type Session = {
  token: string | null;
  user?: unknown | null;
  mfaEnabled?: boolean | null;
};

export type RegulatorSession = {
  token: string | null;
  user?: unknown | null;
};

const SESSION_KEYS = [
  "apgms.session",
  "session",
  "auth.session",
  "cc.session",
];

const TOKEN_KEYS = [
  "apgms.token",
  "token",
  "authToken",
  "auth_token",
  "access_token",
  "jwt",
];

const REGULATOR_SESSION_KEY = "apgms.regulator.session";

function readString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickTokenFromObject(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;

  const candidates = [
    obj.token,
    obj.accessToken,
    obj.access_token,
    obj.jwt,
    obj.idToken,
    obj.id_token,
    obj.sessionToken,
    obj.session_token,
    obj.bearer,
  ];

  for (const c of candidates) {
    const s = readString(c);
    if (s) return s;
  }

  if (obj.auth && typeof obj.auth === "object") {
    return pickTokenFromObject(obj.auth);
  }

  return null;
}

function getFromStorage(key: string): string | null {
  if (typeof window === "undefined") return null;

  const ls = window.localStorage?.getItem(key);
  if (ls) return ls;

  const ss = window.sessionStorage?.getItem(key);
  if (ss) return ss;

  return null;
}

function setInStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    try {
      window.sessionStorage?.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

function removeFromStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

export function getSession(): Session {
  if (typeof window === "undefined") {
    return { token: null, user: null, mfaEnabled: null };
  }

  for (const k of TOKEN_KEYS) {
    const raw = getFromStorage(k);
    const token = readString(raw);
    if (token) return { token, user: null, mfaEnabled: null };
  }

  for (const k of SESSION_KEYS) {
    const raw = getFromStorage(k);
    if (!raw) continue;

    const asToken = readString(raw);
    if (asToken && !raw.trim().startsWith("{") && !raw.trim().startsWith("[")) {
      return { token: asToken, user: null, mfaEnabled: null };
    }

    const parsed = tryParseJson(raw);
    if (parsed && typeof parsed === "object") {
      const token = pickTokenFromObject(parsed as any);
      const user = (parsed as any).user !== undefined ? (parsed as any).user : null;
      const mfaEnabled =
        (parsed as any).mfaEnabled !== undefined ? (parsed as any).mfaEnabled : null;

      return { token, user, mfaEnabled };
    }
  }

  return { token: null, user: null, mfaEnabled: null };
}

export function getRegulatorSession(): RegulatorSession {
  if (typeof window === "undefined") return { token: null, user: null };

  const raw = getFromStorage(REGULATOR_SESSION_KEY);
  if (!raw) return { token: null, user: null };

  const parsed = tryParseJson(raw);
  if (parsed && typeof parsed === "object") {
    const token = pickTokenFromObject(parsed as any);
    const user = (parsed as any).user !== undefined ? (parsed as any).user : null;
    return { token, user };
  }

  const asToken = readString(raw);
  return { token: asToken, user: null };
}

export function setRegulatorSession(sessionOrToken: any, user?: any): void {
  let token: string | null = null;
  let u: any = null;

  if (sessionOrToken && typeof sessionOrToken === "object") {
    token = pickTokenFromObject(sessionOrToken);
    u = sessionOrToken.user !== undefined ? sessionOrToken.user : null;
  } else {
    token = readString(sessionOrToken);
    u = user !== undefined ? user : null;
  }

  setInStorage(REGULATOR_SESSION_KEY, JSON.stringify({ token, user: u }));
}

export function clearRegulatorSession(): void {
  removeFromStorage(REGULATOR_SESSION_KEY);
}
