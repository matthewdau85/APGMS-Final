import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UserRole = "admin" | "user" | "regulator";

export type AuthUser = {
  name: string;
  role: UserRole;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAdmin: boolean;
  login: (u: AuthUser) => void;
  logout: () => void;
};

const STORAGE_KEY = "apgms_auth_v1";

// Legacy keys still used in some older pages/tests.
const LEGACY_USER_KEY = "apgms.auth.user";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isAuthUser(v: unknown): v is AuthUser {
  if (!isRecord(v)) return false;
  const name = v["name"];
  const role = v["role"];
  return (
    typeof name === "string" &&
    (role === "admin" || role === "user" || role === "regulator")
  );
}

function safeJsonParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function canUseStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
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

function readStoredUser(): AuthUser | null {
  if (!canUseStorage()) return null;

  // Highest priority: explicit e2e bypass (dev only).
  if (isE2EBypassEnabled()) {
    return { name: "E2E Admin", role: "admin" };
  }

  // Current storage.
  const current = safeJsonParse(window.localStorage.getItem(STORAGE_KEY));
  if (isAuthUser(current)) return current;

  // Legacy storage used by older tests/pages.
  const legacy = safeJsonParse(window.localStorage.getItem(LEGACY_USER_KEY));
  if (isAuthUser(legacy)) {
    // Migrate forward so the rest of the app sees one source of truth.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    } catch {
      // ignore
    }
    return legacy;
  }

  return null;
}

function writeStoredUser(u: AuthUser | null) {
  if (!canUseStorage()) return;
  try {
    if (!u) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    // ignore
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  // Keep user state synced if localStorage changes in another tab.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY || e.key === LEGACY_USER_KEY) {
        setUser(readStoredUser());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAdmin: user?.role === "admin",
      login: (u: AuthUser) => {
        setUser(u);
        writeStoredUser(u);
      },
      logout: () => {
        setUser(null);
        writeStoredUser(null);
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
