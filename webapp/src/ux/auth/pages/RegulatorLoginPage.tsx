// webapp/src/ux/auth/pages/RegulatorLoginPage.tsx
// ASCII only. LF newlines.

import React, { useState } from "react";
import { regulatorLogin } from "../../shared/data/regulator";

export function RegulatorLoginPage(): JSX.Element {
  const [accessCode, setAccessCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await regulatorLogin({ accessCode });
      // Store regulator token wherever your app expects it (localStorage/context).
    } catch (err) {
      const msg = typeof err === "object" && err !== null && "message" in err ? String((err as any).message) : "Login failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 420 }}>
      <h1>Regulator sign in</h1>
      <form onSubmit={onSubmit}>
        <label>
          Access code
          <input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />
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
