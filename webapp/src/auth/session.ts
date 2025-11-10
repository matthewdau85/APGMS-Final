const SESSION_KEY = "apgms_session";
const LEGACY_TOKEN_KEY = "apgms_token";
const SESSION_CHANGE_EVENT = "apgms:session-changed";

type NullableString = string | null | undefined;

export type SessionUser = {
  id: string;
  orgId: string;
  role: string;
  mfaEnabled: boolean;
};

export type Session = {
  token: string;
  user: SessionUser;
  prototypeEnv?: string;
};

function normalisePrototypeEnv(value: NullableString): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function emitChangeEvent(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

function serialiseSession(session: Session): string {
  const payload: Session = {
    token: session.token,
    user: session.user,
  };
  const proto = normalisePrototypeEnv(session.prototypeEnv);
  if (proto) {
    payload.prototypeEnv = proto;
  } else {
    delete payload.prototypeEnv;
  }
  return JSON.stringify(payload);
}

function parseSession(raw: string | null): Session | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Session & { prototypeEnv?: NullableString };
    const normalised = normalisePrototypeEnv(parsed.prototypeEnv);
    const session: Session = {
      token: parsed.token,
      user: {
        id: parsed.user.id,
        orgId: parsed.user.orgId,
        role: parsed.user.role,
        mfaEnabled: parsed.user.mfaEnabled,
      },
    };
    if (normalised) {
      session.prototypeEnv = normalised;
    }
    return session;
  } catch {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
    return null;
  }
}

function readSession(): Session | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return parseSession(localStorage.getItem(SESSION_KEY));
}

export function saveSession(session: Session): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(SESSION_KEY, serialiseSession(session));
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  emitChangeEvent();
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

  if (update.prototypeEnv === undefined) {
    if (!current.prototypeEnv) {
      delete next.prototypeEnv;
    } else {
      next.prototypeEnv = current.prototypeEnv;
    }
  } else {
    const normalised = normalisePrototypeEnv(update.prototypeEnv);
    if (normalised) {
      next.prototypeEnv = normalised;
    } else {
      delete next.prototypeEnv;
    }
  }

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

export function getPrototypeEnv(): string | null {
  return readSession()?.prototypeEnv ?? null;
}

export function hasPrototypeAccess(): boolean {
  return Boolean(getPrototypeEnv());
}

export function clearSession(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  emitChangeEvent();
}

export function clearToken(): void {
  clearSession();
}

export function subscribeSession(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handleChange = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY) {
      listener();
    }
  };
  window.addEventListener(SESSION_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getSessionKey(): string {
  return SESSION_KEY;
}

export const SESSION_EVENT = SESSION_CHANGE_EVENT;
