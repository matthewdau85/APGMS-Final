// webapp/src/auth.ts
const SESSION_KEY = "apgms_session";
const LEGACY_TOKEN_KEY = "apgms_token";

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

function readSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function updateSession(
  update: Partial<Session> & { user?: Partial<SessionUser> },
): Session | null {
  const current = readSession();
  if (!current) {
    return null;
  }
  const next: Session = {
    ...current,
    ...update,
    user: {
      ...current.user,
      ...(update.user ?? {}),
    },
  };
  saveSession(next);
  return next;
}

export function getSession(): Session | null {
  return readSession();
}

export function getSessionUser(): SessionUser | null {
  return readSession()?.user ?? null;
}

export function getToken(): string | null {
  return readSession()?.token ?? null;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearToken() {
  clearSession();
}
