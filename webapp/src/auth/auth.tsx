import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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

function safeParse(raw: string): AuthUser | null {
  try {
    const obj = JSON.parse(raw) as AuthUser;
    if (!obj || typeof obj.name !== "string" || (obj.role !== "admin" && obj.role !== "user")) return null;
    return obj;
  } catch {
    return null;
  }
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return safeParse(raw);
}

function writeStoredUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    return readStoredUser();
  });

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
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
        writeStoredUser(u);
        setUser(u);
      },
      logout: () => {
        writeStoredUser(null);
        setUser(null);
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
