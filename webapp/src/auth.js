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
