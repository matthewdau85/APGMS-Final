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
const AuthContext = createContext<AuthContextValue | null>(null);

function safeReadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed || typeof parsed.name !== "string" || (parsed.role !== "admin" && parsed.role !== "user")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeWriteUser(u: AuthUser | null) {
  try {
    if (!u) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    // ignore
  }
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => safeReadUser());

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAdmin: user?.role === "admin",
      login: (u: AuthUser) => {
        setUser(u);
        safeWriteUser(u);
      },
      logout: () => {
        setUser(null);
        safeWriteUser(null);
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
