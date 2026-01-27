// webapp/src/ux/auth/pages/LoginPage.tsx
// ASCII only. LF newlines.

import React, { useState } from "react";
import { apiRequest } from "../../shared/data/apiClient";
import type { Session } from "../../../auth";
import { setSession } from "../../../auth";

interface LoginResponse extends Session {}

export function LoginPage(): JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password }
      });
      setSession(session);
      // You likely navigate elsewhere here.
    } catch (err) {
      const msg = typeof err === "object" && err !== null && "message" in err ? String((err as any).message) : "Login failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 420 }}>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
        </label>
        <div style={{ height: 12 }} />
        <button type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        {error ? <p style={{ marginTop: 12 }}>{error}</p> : null}
      </form>
    </div>
  );
}
