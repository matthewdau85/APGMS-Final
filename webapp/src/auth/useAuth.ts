import { useState } from "react";
import { getSession, setSession, clearSession } from "./auth";

export function useAuth() {
  const [session, setState] = useState(() => getSession());

  return {
    session,
    isAuthenticated: !!session,
    login(token: string) {
      const s = { token };
      setSession(s);
      setState(s);
    },
    logout() {
      clearSession();
      setState(null);
    }
  };
}
