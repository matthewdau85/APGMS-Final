import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { regulatorLogin } from "./regulatorAuth";

export default function RegulatorLoginPage() {
  const nav = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [orgId, setOrgId] = useState("org_demo");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await regulatorLogin({ accessCode, orgId });
      nav("/regulator/overview", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        Regulator Login
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Org ID</span>
          <input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="org_demo"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Access code</span>
          <input
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="demo"
          />
        </label>

        {error ? (
          <div style={{ color: "crimson", fontSize: 13 }}>{error}</div>
        ) : null}

        <button type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: 14, fontSize: 12, opacity: 0.8 }}>
        Prototype-only: this uses a demo fallback if the backend login endpoint is
        not implemented.
      </p>
    </div>
  );
}
