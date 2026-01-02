import React, { createContext, useContext, useMemo, useState } from "react";

export type UserRole = "admin" | "user";

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

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed || typeof parsed.name !== "string") return null;
    if (parsed.role !== "admin" && parsed.role !== "user") return null;
    return { name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

function storeUser(u: AuthUser | null) {
  try {
    if (!u) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    // ignore storage failures in demo
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAdmin: user?.role === "admin",
      login: (u: AuthUser) => {
        setUser(u);
        storeUser(u);
      },
      logout: () => {
        setUser(null);
        storeUser(null);
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
