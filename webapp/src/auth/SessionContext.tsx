import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useSyncExternalStore } from "react";

import {
  getSession,
  subscribeSession,
  type Session,
} from "./session";

interface SessionContextValue {
  session: Session | null;
  prototypeEnv: string | null;
  hasPrototypeAccess: boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function readSession(): Session | null {
  return getSession();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, readSession, readSession);

  const value = useMemo<SessionContextValue>(() => {
    const prototypeEnv = session?.prototypeEnv ?? null;
    return {
      session,
      prototypeEnv,
      hasPrototypeAccess: Boolean(prototypeEnv),
    };
  }, [session]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}
