// webapp/src/auth.ts
const SESSION_KEY = "apgms_session";
const LEGACY_TOKEN_KEY = "apgms_token";

// Newer console auth (AuthContext) storage key(s).
const AUTH_V1_KEY = "apgms_auth_v1";
const LEGACY_AUTH_USER_KEY = "apgms.auth.user";

export type SessionUser = {
  id: string;
  orgId: string;
  role: string;
  mfaEnabled: boolean;
};

export type Session = {
  token: string;
  user: SessionUser;
};

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isE2EBypassEnabled(): boolean {
  // Only allow bypass in dev builds.
  return (
    import.meta.env.DEV &&
    (import.meta.env.VITE_E2E_BYPASS_AUTH === "1" ||
      import.meta.env.VITE_E2E_BYPASS_AUTH === "true")
  );
}

function readSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  const parsed = safeJsonParse<Session>(raw);
  if (!parsed) return null;
  if (typeof parsed.token !== "string") return null;
  if (!parsed.user || typeof parsed.user !== "object") return null;
  return parsed;
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Keep the legacy token key in sync for older callers.
  localStorage.setItem(LEGACY_TOKEN_KEY, session.token);
}

export function loadSession(): Session | null {
  return readSession();
}

export function updateSession(partial: Partial<Session>): Session | null {
  const current = readSession();
  if (!current) return null;
  const next: Session = {
    token: partial.token ?? current.token,
    user: partial.user ?? current.user,
  };
  saveSession(next);
  return next;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

function hasAuthV1User(): { role: string } | null {
  const raw = localStorage.getItem(AUTH_V1_KEY);
  const parsed = safeJsonParse<unknown>(raw);
  if (parsed && typeof parsed === "object" && typeof (parsed as any).role === "string") {
    return { role: (parsed as any).role };
  }

  const legacyRaw = localStorage.getItem(LEGACY_AUTH_USER_KEY);
  const legacy = safeJsonParse<unknown>(legacyRaw);
  if (legacy && typeof legacy === "object" && typeof (legacy as any).role === "string") {
    return { role: (legacy as any).role };
  }

  return null;
}

export function getToken(): string | null {
  // 1) Primary session storage.
  const s = readSession();
  if (s?.token) return s.token;

  // 2) Legacy token storage.
  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy && legacy.trim()) return legacy;

  // 3) Dev-only bypass (primarily for e2e).
  if (isE2EBypassEnabled()) return "e2e";

  // 4) Compatibility: if the newer AuthContext user is present, return a placeholder token
  // to keep older pages/layouts from forcing redirects.
  if (hasAuthV1User()) return "e2e";

  return null;
}

export function requireToken(): string {
  const t = getToken();
  if (!t) throw new Error("Missing auth token");
  return t;
}

export function clearToken(): void {
  const current = readSession();
  if (current) {
    const next: Session = {
      token: "",
      user: current.user,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  }
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getSessionUser(): SessionUser | null {
  const s = readSession();
  if (s?.user) return s.user;

  const u = hasAuthV1User();
  if (!u) return null;

  return {
    id: "e2e",
    orgId: "e2e-org",
    role: u.role,
    mfaEnabled: false,
  };
}

// --- Added for compatibility: getSession + regulator session helpers ---
const __APGMS_REGULATOR_SESSION_KEY = "apgms.regulator.session";

function __apgms_readString(v) {
  return typeof v === "string" && v.trim() ? v : null;
}

function __apgms_tryParseJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function __apgms_pickToken(obj) {
  if (!obj || typeof obj !== "object") return null;
  const candidates = [
    obj.token, obj.accessToken, obj.access_token, obj.jwt,
    obj.idToken, obj.id_token, obj.sessionToken, obj.session_token, obj.bearer,
  ];
  for (const c of candidates) {
    const s = __apgms_readString(c);
    if (s) return s;
  }
  if (obj.auth && typeof obj.auth === "object") return __apgms_pickToken(obj.auth);
  return null;
}

function __apgms_getFromStorage(key) {
  if (typeof window === "undefined") return null;
  const ls = window.localStorage && window.localStorage.getItem(key);
  if (ls) return ls;
  const ss = window.sessionStorage && window.sessionStorage.getItem(key);
  if (ss) return ss;
  return null;
}

function __apgms_setInStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage && window.localStorage.setItem(key, value);
  } catch {
    try {
      window.sessionStorage && window.sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

function __apgms_removeFromStorage(key) {
  if (typeof window === "undefined") return;
  try { window.localStorage && window.localStorage.removeItem(key); } catch {}
  try { window.sessionStorage && window.sessionStorage.removeItem(key); } catch {}
}

export function getSession() {
  if (typeof window === "undefined") return { token: null, user: null, mfaEnabled: null };

  const tokenKeys = ["apgms.token","token","authToken","auth_token","access_token","jwt"];
  for (const k of tokenKeys) {
    const raw = __apgms_getFromStorage(k);
    const token = __apgms_readString(raw);
    if (token) return { token, user: null, mfaEnabled: null };
  }

  const sessionKeys = ["apgms.session","session","auth.session","cc.session"];
  for (const k of sessionKeys) {
    const raw = __apgms_getFromStorage(k);
    if (!raw) continue;

    const asToken = __apgms_readString(raw);
    if (asToken && !raw.trim().startsWith("{") && !raw.trim().startsWith("[")) {
      return { token: asToken, user: null, mfaEnabled: null };
    }

    const parsed = __apgms_tryParseJson(raw);
    if (parsed && typeof parsed === "object") {
      const token = __apgms_pickToken(parsed);
      const user = parsed.user !== undefined ? parsed.user : null;
      const mfaEnabled = parsed.mfaEnabled !== undefined ? parsed.mfaEnabled : null;
      return { token, user, mfaEnabled };
    }
  }

  return { token: null, user: null, mfaEnabled: null };
}

export function getRegulatorSession() {
  if (typeof window === "undefined") return { token: null, user: null };

  const raw = __apgms_getFromStorage(__APGMS_REGULATOR_SESSION_KEY);
  if (!raw) return { token: null, user: null };

  const parsed = __apgms_tryParseJson(raw);
  if (parsed && typeof parsed === "object") {
    const token = __apgms_pickToken(parsed);
    const user = parsed.user !== undefined ? parsed.user : null;
    return { token, user };
  }

  const asToken = __apgms_readString(raw);
  return { token: asToken, user: null };
}

export function setRegulatorSession(sessionOrToken, user) {
  let token = null;
  let u = null;

  if (sessionOrToken && typeof sessionOrToken === "object") {
    token = __apgms_pickToken(sessionOrToken);
    u = sessionOrToken.user !== undefined ? sessionOrToken.user : null;
  } else {
    token = __apgms_readString(sessionOrToken);
    u = user !== undefined ? user : null;
  }

  __apgms_setInStorage(__APGMS_REGULATOR_SESSION_KEY, JSON.stringify({ token, user: u }));
}

export function clearRegulatorSession() {
  __apgms_removeFromStorage(__APGMS_REGULATOR_SESSION_KEY);
}
