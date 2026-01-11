import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function HomePage() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>APGMS</h1>
          <p style={{ opacity: 0.8, marginTop: 8 }}>
            Control-plane and evidence system for tax obligations (demo shell).
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {user ? (
            <>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                Signed in as <strong>{user.name}</strong> ({user.role})
              </div>
              <button
                onClick={logout}
                style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", cursor: "pointer" }}
              >
                Sign out
              </button>
              {isAdmin ? (
                <Link
                  to="/admin"
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", textDecoration: "none" }}
                >
                  Admin
                </Link>
              ) : null}
            </>
          ) : (
            <Link
              to="/login"
              style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", textDecoration: "none" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Demo positioning</h3>
          <p style={{ opacity: 0.85, marginBottom: 0 }}>
            APGMS ingests transaction feeds, enforces funding and reconciliation controls, orchestrates lodgment and payment steps,
            and produces regulator-grade evidence packs.
          </p>
        </div>

        <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Next</h3>
          <p style={{ opacity: 0.85, marginBottom: 0 }}>
            Sign in as Admin to access the Compliance Console and run the end-to-end demo with feeds, lodgments, and evidence packs.
          </p>
        </div>
      </div>
    </div>
  );
}
