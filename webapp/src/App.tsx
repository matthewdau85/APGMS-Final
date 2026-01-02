import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/LoginPage";

import PrototypeShell from "./prototype/PrototypeShell";
import OverviewPage from "./prototype/pages/OverviewPage";
import ObligationsPage from "./prototype/pages/ObligationsPage";
import FeedsPage from "./prototype/pages/FeedsPage";
import LodgmentsPage from "./prototype/pages/LodgmentsPage";
import EvidencePackPage from "./prototype/pages/EvidencePackPage";

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div style={{ padding: 18 }}>Loading...</div>;
  if (!user || user.role !== "admin") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Home() {
  const nav = useNavigate();
  const { user, isLoading, logout } = useAuth();

  if (isLoading) return <div style={{ padding: 18 }}>Loading...</div>;

  return (
    <div style={{ padding: 18 }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>APGMS (Production UI placeholder)</h1>
      <p style={{ opacity: 0.8 }}>
        This is where your real production UX lives. The Prototype is admin-gated and looks production-grade.
      </p>

      {!user ? (
        <button className="button primary" onClick={() => nav("/login")}>
          Admin Login
        </button>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="pill">
            <span className="muted">User</span>
            <strong>{user.email}</strong>
          </div>

          {user.role === "admin" ? (
            <button className="button primary" onClick={() => nav("/prototype")}>
              Prototype
            </button>
          ) : null}

          <button className="button" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/prototype/*"
        element={
          <AdminOnly>
            <PrototypeShell />
          </AdminOnly>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="obligations" element={<ObligationsPage />} />
        <Route path="feeds" element={<FeedsPage />} />
        <Route path="lodgments" element={<LodgmentsPage />} />
        <Route path="evidence-pack" element={<EvidencePackPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
