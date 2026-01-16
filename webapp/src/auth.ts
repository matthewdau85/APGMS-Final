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
