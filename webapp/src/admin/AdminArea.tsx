import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AdminArea() {
  const nav = useNavigate();
  const { user, isAdmin, logout } = useAuth();

  if (!user) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0 }}>Admin</h1>
        <p style={{ opacity: 0.8, marginTop: 8 }}>You must sign in first.</p>
        <Link to="/login">Go to sign in</Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0 }}>Admin</h1>
        <p style={{ opacity: 0.8, marginTop: 8 }}>Access denied. This area requires Admin role.</p>
        <Link to="/">Return to Home</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Admin</h1>
          <p style={{ opacity: 0.8, marginTop: 8 }}>
            Admin-only entry points and demo controls.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Signed in as <strong>{user.name}</strong> ({user.role})
          </div>
          <button
            onClick={() => {
              logout();
              nav("/");
            }}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", cursor: "pointer" }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Compliance Console</h3>
          <p style={{ opacity: 0.85 }}>
            Admin-only. The console is production-like UX with mocked data, feeds, lodgments, evidence packs, and a demo guide.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              to="/proto"
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                textDecoration: "none",
              }}
            >
              Open APGMS Console (Demo Mode)
            </Link>
            <Link to="/" style={{ alignSelf: "center" }}>
              Back to Home
            </Link>
          </div>
        </div>

        <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Demo notes</h3>
          <ul style={{ opacity: 0.85, marginBottom: 0 }}>
            <li>User login should not see console entry.</li>
            <li>Direct URL access to /proto is protected by routing guard.</li>
            <li>Inside the console you can toggle Simulation and Reset demo state.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
