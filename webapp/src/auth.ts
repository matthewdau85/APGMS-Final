// webapp/src/auth.ts
// Single source of truth for browser session + auth headers.
// ASCII only. LF newlines.

export type UserRole = "admin" | "user" | "regulator";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  orgId: string;
  mfaEnabled: boolean;
}

export interface Session {
  token: string;
  expiresAt: string; // ISO string
  user: SessionUser;
}

const STORAGE_KEY = "apgms.session.v1";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function isUserRole(v: unknown): v is UserRole {
  return v === "admin" || v === "user" || v === "regulator";
}

function parseSession(raw: unknown): Session | null {
  if (!isRecord(raw)) return null;

  const token = raw["token"];
  const expiresAt = raw["expiresAt"];
  const user = raw["user"];

  if (!isString(token) || !isString(expiresAt) || !isRecord(user)) return null;

  const id = user["id"];
  const email = user["email"];
  const role = user["role"];
  const orgId = user["orgId"];
  const mfaEnabled = user["mfaEnabled"];

  if (!isString(id) || !isString(email) || !isUserRole(role) || !isString(orgId) || !isBoolean(mfaEnabled)) {
    return null;
  }

  return {
    token,
    expiresAt,
    user: {
      id,
      email,
      role,
      orgId,
      mfaEnabled
    }
  };
}

export function getSession(): Session | null {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    if (!txt) return null;
    const obj: unknown = JSON.parse(txt);
    const s = parseSession(obj);
    if (!s) return null;

    // Expiry check (best-effort)
    const exp = Date.parse(s.expiresAt);
    if (Number.isFinite(exp) && Date.now() > exp) {
      clearSession();
      return null;
    }

    return s;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAuthHeader(sessionOrToken: Session | string | null): Record<string, string> {
  const token = typeof sessionOrToken === "string" ? sessionOrToken : sessionOrToken?.token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function getOrgId(sessionOrToken: Session | string | null, user?: SessionUser | null): string | null {
  if (typeof sessionOrToken === "string") return user?.orgId ?? null;
  return sessionOrToken?.user?.orgId ?? null;
}
