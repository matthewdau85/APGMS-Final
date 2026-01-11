import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { regulatorLogin, setRegulatorSession } from "./regulatorAuth";

export default function RegulatorLoginPage() {
  const nav = useNavigate();
  const loc = useLocation();

  const [orgId, setOrgId] = useState<string>("");
  const [accessCode, setAccessCode] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // If user was redirected here by RequireAdmin, it may include a `from`.
  const from = (loc.state as any)?.from as string | undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedOrg = orgId.trim();
    const trimmedCode = accessCode.trim();

    if (!trimmedOrg || !trimmedCode) {
      setError("Org ID and Access Code are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await regulatorLogin({ orgId: trimmedOrg, accessCode: trimmedCode });
      setRegulatorSession({ orgId: trimmedOrg, token: res.token, expiresAt: res.expiresAt });

      // Deterministic landing. If redirected with a `from`, honor it.
      // Otherwise go to the canonical regulator portal route.
      nav(from || "/regulator-portal", { replace: true });
    } catch (e2: unknown) {
      setError(toErrorMessage(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 480 }}>
      <h2>Regulator Login</h2>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Org ID
            <input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              style={{ display: "block", width: "100%", padding: 8 }}
              autoComplete="off"
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Access Code
            <input
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              style={{ display: "block", width: "100%", padding: 8 }}
              autoComplete="off"
            />
          </label>
        </div>

        {error ? <div style={{ marginBottom: 12, color: "crimson" }}>{error}</div> : null}

        <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
