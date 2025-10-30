import React, { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  clearRegulatorSession,
  getRegulatorSession,
} from "./regulatorAuth";

const navItems: Array<{ to: string; label: string }> = [
  { to: "/regulator/portal/overview", label: "Overview" },
  { to: "/regulator/portal/evidence", label: "Evidence Library" },
  { to: "/regulator/portal/monitoring", label: "Monitoring" },
];

export default function RegulatorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getRegulatorSession();

  useEffect(() => {
    if (!session) {
      navigate("/regulator", {
        replace: true,
        state: { from: location.pathname },
      });
    }
  }, [session, navigate, location.pathname]);

  if (!session) {
    return null;
  }

  function handleLogout() {
    clearRegulatorSession();
    navigate("/regulator", { replace: true });
  }

  return (
    <div style={outerStyle}>
      <aside style={sidebarStyle}>
        <div style={{ display: "grid", gap: "24px" }}>
          <div>
            <div style={brandStyle}>APGMS</div>
            <div style={portalTitleStyle}>Regulator Portal</div>
            <div style={orgBadgeStyle}>
              Reviewing <strong>{session.orgId}</strong>
            </div>
          </div>
          <nav style={{ display: "grid", gap: "8px" }}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#0b5fff" : "#1e293b",
                  backgroundColor: isActive ? "rgba(11, 95, 255, 0.1)" : "transparent",
                  textDecoration: "none",
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
          Sign out
        </button>
      </aside>
      <main style={contentShellStyle}>
        <div style={contentInnerStyle}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const outerStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  backgroundColor: "#f8fafc",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const sidebarStyle: React.CSSProperties = {
  width: "260px",
  background: "#ffffff",
  borderRight: "1px solid #e2e8f0",
  padding: "28px 22px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const brandStyle: React.CSSProperties = {
  fontSize: "14px",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontWeight: 700,
  color: "#6366f1",
};

const portalTitleStyle: React.CSSProperties = {
  marginTop: "6px",
  fontSize: "20px",
  fontWeight: 700,
  color: "#0f172a",
};

const orgBadgeStyle: React.CSSProperties = {
  marginTop: "12px",
  fontSize: "13px",
  color: "#475569",
  background: "#e2e8f0",
  borderRadius: "999px",
  padding: "6px 12px",
  display: "inline-block",
};

const contentShellStyle: React.CSSProperties = {
  flex: 1,
  padding: "36px",
  overflowY: "auto",
};

const contentInnerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  display: "grid",
  gap: "24px",
};

const logoutButtonStyle: React.CSSProperties = {
  marginTop: "32px",
  padding: "10px 12px",
  fontSize: "14px",
  borderRadius: "8px",
  border: "1px solid #cbd5f5",
  background: "transparent",
  color: "#1e293b",
  cursor: "pointer",
  fontWeight: 500,
};
