// webapp/src/auth/AuthContext.tsx
// ASCII only. LF newlines.

import React, { createContext, useContext, useMemo, useState } from "react";
import type { Session, SessionUser, UserRole } from "../auth";
import { clearSession, getSession, setSession } from "../auth";

export type AuthUser = SessionUser;

export interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (session: Session) => void;
  clear: () => void;
  role: UserRole | null;
  orgId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider(props: { children: React.ReactNode }): JSX.Element {
  const [sessionState, setSessionState] = useState<Session | null>(() => getSession());

  const value = useMemo<AuthContextType>(() => {
    const user = sessionState?.user ?? null;
    return {
      session: sessionState,
      user,
      isAuthenticated: !!sessionState,
      setSession: (s: Session) => {
        setSession(s);
        setSessionState(s);
      },
      clear: () => {
        clearSession();
        setSessionState(null);
      },
      role: user?.role ?? null,
      orgId: user?.orgId ?? null
    };
  }, [sessionState]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
