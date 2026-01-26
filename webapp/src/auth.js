// webapp/src/auth.js
// Simple session helpers as ES module for Vite.

const STORAGE_KEY = "apgms.session";

export function saveSession(session) {
  // session is expected to include at least a token and maybe org/user info
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Canonical helper for the auth token
export function getAuthToken() {
  const session = loadSession();
  return session?.token ?? null;
}

// Backwards-compat alias used by existing components (e.g. DashboardPage)
export function getToken() {
  return getAuthToken();
}

// Backwards-compat helper used by AlertsPage, SecurityPage, etc.
export function getSessionUser() {
  const session = loadSession();
  // Adjust this later if your session payload shape is different
  return session?.user ?? null;
}

// Used by SecurityPage.tsx to update MFA flags / user details etc.
export function updateSession(patch) {
  const current = loadSession() ?? {};
  const next = { ...current, ...patch };
  saveSession(next);
  return next;
}

// Backwards-compat helper used by ProtectedLayout.tsx
export function clearToken() {
  // This effectively logs the user out by wiping the stored session
  clearSession();
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
