import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "../auth/AuthContext";

export default function LoginPage() {
  const nav = useNavigate();
  const { user, login, logout } = useAuth();
  const [name, setName] = useState<string>(user?.name ?? "Demo User");
  const [role, setRole] = useState<UserRole>(user?.role ?? "user");

  const canLogin = useMemo(() => name.trim().length >= 2, [name]);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
      <h1 style={{ margin: 0 }}>APGMS</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Demo authentication (local only). Use Admin to access the Console.
      </p>

      <div style={{ marginTop: 18, display: "grid", gap: 12, padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Display name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent" }}
          />
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.8, minWidth: 90 }}>Role</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="radio" checked={role === "user"} onChange={() => setRole("user")} />
            User
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="radio" checked={role === "admin"} onChange={() => setRole("admin")} />
            Admin
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            disabled={!canLogin}
            onClick={() => {
              login({ name: name.trim(), role });
              nav(role === "admin" ? "/admin" : "/");
            }}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", cursor: "pointer" }}
          >
            Sign in
          </button>

          {user && (
            <button
              onClick={() => {
                logout();
                nav("/");
              }}
              style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", cursor: "pointer" }}
            >
              Sign out
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Admin-only behavior:
          <ul style={{ marginTop: 6 }}>
            <li>User login: no Console entry button.</li>
            <li>Admin login: see “Open APGMS Console (Demo Mode)”.</li>
            <li>Direct URL protection: non-admin hitting /proto redirects away.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
