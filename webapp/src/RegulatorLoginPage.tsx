import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveRegulatorSession } from "./regulatorAuth";

export default function RegulatorLoginPage() {
  const navigate = useNavigate();

  const [orgId, setOrgId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const trimmedOrgId = orgId.trim();
      const trimmedToken = token.trim();

      if (!trimmedOrgId) {
        throw new Error("Org ID is required.");
      }
      if (!trimmedToken) {
        throw new Error("Token is required.");
      }

      // FIX: saveRegulatorSession expects (token, orgId)
      saveRegulatorSession(trimmedToken, trimmedOrgId);

      navigate("/", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Regulator Login</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Enter your regulator session token and organisation identifier.
      </p>

      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Org ID</div>
          <input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="e.g. demo-org"
            autoComplete="organization"
            style={{ width: "100%", padding: 10 }}
          />
        </label>

        <label style={{ display: "block", marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Token</div>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste token"
            autoComplete="off"
            style={{ width: "100%", padding: 10 }}
          />
        </label>

        {error ? (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: 10,
              border: "1px solid rgba(255,0,0,0.35)",
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ marginTop: 16, padding: "10px 14px", cursor: "pointer" }}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
