import React, { useMemo, useState } from "react";
import { useAuth, type UserRole } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [name, setName] = useState("Matthew");
  const canLogin = useMemo(() => name.trim().length >= 2, [name]);

  const doLogin = (role: UserRole) => {
    if (!canLogin) return;
    login({ name: name.trim(), role });
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "min(720px, 100%)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>APGMS</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>Sign in</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, textAlign: "right" }}>
            Demo auth (local only)
            <div style={{ marginTop: 2 }}>Admin-gated console at /proto/*</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.2)",
              color: "inherit",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => doLogin("user")}
            disabled={!canLogin}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: canLogin ? "pointer" : "not-allowed",
            }}
          >
            Sign in as User
          </button>

          <button
            onClick={() => doLogin("admin")}
            disabled={!canLogin}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.10)",
              color: "inherit",
              cursor: canLogin ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            Sign in as Admin
          </button>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
          Admin can open the production-like console (mocked data, deterministic simulation, evidence packs).
          Users cannot see the console entry button and cannot access /proto/*.
        </div>
      </div>
    </div>
  );
}
