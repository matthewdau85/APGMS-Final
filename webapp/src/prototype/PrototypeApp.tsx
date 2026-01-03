import React, { useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PrototypeProvider, usePrototype } from "./store";
import "./prototype.css";

import DashboardPage from "./pages/DashboardPage";
import ObligationsPage from "./pages/ObligationsPage";
import LedgerPage from "./pages/LedgerPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import EvidencePackPage from "./pages/EvidencePackPage";
import ControlsPoliciesPage from "./pages/ControlsPoliciesPage";
import IncidentsPage from "./pages/IncidentsPage";
import SettingsPage from "./pages/SettingsPage";
import RegulatorPortalPage from "./pages/RegulatorPortalPage";
import SetupWizardPage from "./pages/SetupWizardPage";

import { DemoGuide } from "./components/DemoGuide";

function RequireSetup(props: { children: React.ReactNode }) {
  const { state } = usePrototype();
  const loc = useLocation();

  if (!state.settings.wizardCompleted && !loc.pathname.endsWith("/setup")) {
    return <Navigate to="/proto/setup" replace />;
  }
  return <>{props.children}</>;
}

function ConsoleLayout() {
  const { user } = useAuth();
  const { state, setPeriod } = usePrototype();
  const [showGuide, setShowGuide] = useState(false);

  const periods = useMemo(() => ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"] as const, []);
  const orgTitle = state.settings.orgName;

  return (
    <div className="apgms-proto">
      <div className="apgms-proto__layout">
        <aside className="apgms-proto__sidebar">
          <div className="apgms-proto__brand">
            <h2>APGMS Console</h2>
            <div className="sub">Demo Mode (Admin-only)</div>
          </div>

          <nav className="apgms-proto__nav">
            <NavLink to="/proto/dashboard">Dashboard</NavLink>
            <NavLink to="/proto/obligations">Obligations</NavLink>
            <NavLink to="/proto/ledger">Ledger</NavLink>
            <NavLink to="/proto/reconciliation">Reconciliation</NavLink>
            <NavLink to="/proto/evidence-pack">Evidence Pack</NavLink>
            <NavLink to="/proto/controls">Controls & Policies</NavLink>
            <NavLink to="/proto/incidents">Incidents</NavLink>
            <NavLink to="/proto/settings">Settings</NavLink>
            <NavLink to="/proto/regulator-portal">Regulator Portal</NavLink>
          </nav>

          <div className="apgms-proto__card" style={{ padding: 12, borderRadius: 14 }}>
            <div className="apgms-proto__muted"><strong>Org:</strong> {orgTitle}</div>
            <div className="apgms-proto__muted"><strong>User:</strong> {user?.name ?? "Unknown"} (admin)</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="apgms-proto__btn secondary" to="/admin">Exit console</Link>
              <button className="apgms-proto__btn secondary" onClick={() => setShowGuide(true)}>Demo guide</button>
            </div>
          </div>
        </aside>

        <main className="apgms-proto__content">
          <div className="apgms-proto__topbar">
            <div className="left">
              <div className="title">{orgTitle}</div>
              <div className="meta">Operational console for obligations, controls, and evidence (demo).</div>
            </div>

            <div className="apgms-proto__controls">
              <div className="apgms-proto__muted">Period</div>
              <select className="apgms-proto__select" value={state.period} onChange={(e) => setPeriod(e.target.value as any)}>
                {periods.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <RequireSetup>
              <Routes>
                <Route path="/" element={<Navigate to="/proto/dashboard" replace />} />

                <Route path="/setup" element={<SetupWizardPage />} />

                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/obligations" element={<ObligationsPage />} />
                <Route path="/ledger" element={<LedgerPage />} />
                <Route path="/reconciliation" element={<ReconciliationPage />} />
                <Route path="/evidence-pack" element={<EvidencePackPage />} />
                <Route path="/controls" element={<ControlsPoliciesPage />} />
                <Route path="/incidents" element={<IncidentsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/regulator-portal" element={<RegulatorPortalPage />} />

                <Route path="*" element={<Navigate to="/proto/dashboard" replace />} />
              </Routes>
            </RequireSetup>
          </div>

          {showGuide ? <DemoGuide onClose={() => setShowGuide(false)} /> : null}
        </main>
      </div>
    </div>
  );
}

export function PrototypeApp() {
  return (
    <PrototypeProvider>
      <ConsoleLayout />
    </PrototypeProvider>
  );
}
