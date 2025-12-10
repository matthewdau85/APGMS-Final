// webapp/src/regulatorAuth.js
// Session helpers for the regulator / ATO-style view.

const STORAGE_KEY = "apgms.regulator.session";

export function saveRegulatorSession(session) {
  // Expected shape is whatever `regulatorLogin` returns,
  // usually including at least: { token, orgId, ... }.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function loadRegulatorSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Alias used by RegulatorLayout
export function getRegulatorSession() {
  return loadRegulatorSession();
}

export function clearRegulatorSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getRegulatorToken() {
  const session = loadRegulatorSession();
  return session?.token ?? null;
}

export function getRegulatorOrgId() {
  const session = loadRegulatorSession();
  return session?.orgId ?? null;
}

// If you later attach user / officer info to the regulator session.
export function getRegulatorSessionUser() {
  const session = loadRegulatorSession();
  return session?.user ?? null;
}
