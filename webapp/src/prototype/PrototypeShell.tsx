import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useDemoStore } from "./store";
import "./prototype.css";

const PERIODS = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"] as const;

export default function PrototypeShell() {
  const { user, logout } = useAuth();
  const { period, setPeriod, settings, toggleSimulation, resetDemoState } = useDemoStore();

  return (
    <div className="apgms-proto">
      <aside className="apgms-proto__sidebar">
        <div className="apgms-proto__brand">
          <div>
            <div className="apgms-proto__title">APGMS</div>
            <div className="apgms-proto__subtitle">Console (Demo Mode)</div>
          </div>
          <span className="apgms-proto__badge">admin-only</span>
        </div>

        <nav className="apgms-proto__nav">
          <NavLink to="/proto/dashboard">Dashboard</NavLink>
          <NavLink to="/proto/obligations">Obligations</NavLink>
          <NavLink to="/proto/ledger">Ledger</NavLink>
          <NavLink to="/proto/reconciliation">Reconciliation</NavLink>
          <NavLink to="/proto/evidence">Evidence Pack</NavLink>
          <NavLink to="/proto/controls">Controls & Policies</NavLink>
          <NavLink to="/proto/incidents">Incidents</NavLink>
          <NavLink to="/proto/settings">Settings</NavLink>
          <NavLink to="/proto/regulator">Regulator Portal (read-only)</NavLink>
          <NavLink to="/proto/demo">Demo Guide</NavLink>
        </nav>

        <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Signed in</div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{user?.name} (admin)</div>
          <button className="apgms-proto__btn" onClick={logout} style={{ marginTop: 10 }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="apgms-proto__main">
        <div className="apgms-proto__topbar">
          <div className="apgms-proto__topbar-left">
            <select className="apgms-proto__input" value={period} onChange={(e) => setPeriod(e.target.value as any)}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <input className="apgms-proto__input" placeholder="Search (demo)" style={{ width: 260 }} />
          </div>

          <div className="apgms-proto__topbar-right">
            <button
              className={"apgms-proto__btn " + (settings.simulation.enabled ? "apgms-proto__btn--primary" : "")}
              onClick={() => toggleSimulation(!settings.simulation.enabled)}
              title={"Incoming feed simulation (default interval " + settings.simulation.feedIntervalSeconds + "s)"}
            >
              {"Simulation " + (settings.simulation.enabled ? "ON" : "OFF")}
            </button>

            <button className="apgms-proto__btn" onClick={resetDemoState}>
              Reset demo state
            </button>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
