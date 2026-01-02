import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "../ui/ui.css";

export default function PrototypeShell() {
  const nav = useNavigate();
  const { user, logout } = useAuth();

  const [orgId, setOrgId] = React.useState("org_1");
  const [period, setPeriod] = React.useState("2025-Q1");

  async function onLogout() {
    await logout();
    nav("/login");
  }

  return (
    <div className="container">
      <aside className="sidebar">
        <div className="brand">APGMS Prototype</div>
        <div className="pill" title="Admin-only surface">
          <span>Role:</span> <strong>{user?.role ?? "unknown"}</strong>
        </div>

        <nav className="nav" style={{ marginTop: 14 }}>
          <NavLink to="/prototype" end>
            Overview
          </NavLink>
          <NavLink to="/prototype/obligations">Obligations</NavLink>
          <NavLink to="/prototype/feeds">Feeds</NavLink>
          <NavLink to="/prototype/lodgments">Lodgments</NavLink>
          <NavLink to="/prototype/evidence-pack">Evidence Pack</NavLink>
        </nav>

        <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
          <button className="button danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="left">
            <div className="pill">
              <span className="muted">Org</span>
              <select className="select" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="org_1">org_1</option>
                <option value="org_2">org_2</option>
              </select>
            </div>

            <div className="pill">
              <span className="muted">Period</span>
              <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="2025-Q1">2025-Q1</option>
                <option value="2025-Q2">2025-Q2</option>
                <option value="2025-Q3">2025-Q3</option>
                <option value="2025-Q4">2025-Q4</option>
              </select>
            </div>
          </div>

          <div className="right">
            <div className="pill">
              <span className="muted">User</span>
              <strong>{user?.email ?? "—"}</strong>
            </div>
          </div>
        </div>

        <Outlet context={{ orgId, period }} />
      </main>
    </div>
  );
}
