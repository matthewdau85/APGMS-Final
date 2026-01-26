export type AuthSession = {
  token: string;
};

const STORAGE_KEY = "apgms.session";

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (typeof parsed.token !== "string") return null;

    return parsed;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}
