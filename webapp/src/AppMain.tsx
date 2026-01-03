import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/LoginPage";
import { AdminArea } from "./admin/AdminArea";

function Shell(props: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: "100vh", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>APGMS</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>Home</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Signed in as <span style={{ fontWeight: 700 }}>{user?.name}</span> ({user?.role})
          </div>
          <button
            onClick={logout}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
          {"APGMS is a control-plane and evidence system for tax obligations: it ingests transaction feeds, enforces funding and reconciliation controls, orchestrates lodgment and payment steps, and produces regulator-grade evidence packs."}
        </div>

        <AdminArea />

        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
          This page is intentionally minimal. The production-like UX is in the admin-gated console.
        </div>
      </div>
    </div>
  );
}

export default function AppMain() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;

  // If a non-admin tries /proto directly, they are blocked inside PrototypeApp.
  // AppMain stays as normal app root.
  if (window.location.pathname.startsWith("/proto")) {
    return <Navigate to="/" replace />;
  }

  return <Shell>OK</Shell>;
}
