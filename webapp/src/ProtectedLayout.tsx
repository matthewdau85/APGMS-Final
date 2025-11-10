import React, { useEffect, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "./auth";
import { useSessionContext } from "./auth/SessionContext";

const navItems: Array<{ to: string; label: string; prototypeOnly?: boolean }> = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/feeds", label: "Payroll & GST Feeds", prototypeOnly: true },
  { to: "/alerts", label: "Alerts", prototypeOnly: true },
  { to: "/bas", label: "BAS Lodgment", prototypeOnly: true },
  { to: "/compliance", label: "Compliance", prototypeOnly: true },
  { to: "/security", label: "Security / Access" },
];

const prototypeRoutes = new Set(navItems.filter((item) => item.prototypeOnly).map((item) => item.to));

export default function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, hasPrototypeAccess, prototypeEnv } = useSessionContext();
  const token = session?.token ?? null;

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => hasPrototypeAccess || !item.prototypeOnly),
    [hasPrototypeAccess],
  );

  useEffect(() => {
    if (!token) {
      navigate("/", { replace: true, state: { from: location.pathname } });
      return;
    }
    if (!hasPrototypeAccess && prototypeRoutes.has(location.pathname)) {
      navigate("/dashboard", { replace: true });
    }
  }, [token, navigate, location.pathname, hasPrototypeAccess]);

  if (!token) {
    return null;
  }

  function handleLogout() {
    clearToken();
    navigate("/", { replace: true });
  }

  return (
    <div style={outerShellStyle}>
      <aside style={sidebarStyle}>
        <div>
          <div style={brandStyle}>APGMS Admin</div>
          {prototypeEnv && (
            <div style={prototypePillStyle}>Prototype: {prototypeEnv}</div>
          )}
          <nav style={{ display: "grid", gap: "8px" }}>
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "10px 12px",
                  fontSize: "14px",
                  borderRadius: "6px",
                  color: isActive ? "#0b5fff" : "#1d2633",
                  backgroundColor: isActive ? "rgba(11, 95, 255, 0.1)" : "transparent",
                  textDecoration: "none",
                  fontWeight: isActive ? 600 : 500,
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {!hasPrototypeAccess && (
            <div style={prototypeNoticeStyle}>
              Prototype modules are hidden outside pilot environments.
            </div>
          )}
        </div>
        <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
          Log out
        </button>
      </aside>

      <main style={mainAreaStyle}>
        <div style={contentStyle}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const outerShellStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  backgroundColor: "#f5f7fb",
};

const sidebarStyle: React.CSSProperties = {
  width: "240px",
  padding: "24px 20px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  borderRight: "1px solid #e2e8f0",
  backgroundColor: "#ffffff",
};

const brandStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  marginBottom: "24px",
};

const prototypePillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  backgroundColor: "rgba(11, 95, 255, 0.12)",
  color: "#0b5fff",
  fontSize: "12px",
  fontWeight: 600,
  borderRadius: "999px",
  padding: "4px 10px",
  marginBottom: "16px",
};

const prototypeNoticeStyle: React.CSSProperties = {
  marginTop: "16px",
  fontSize: "12px",
  color: "#475569",
  lineHeight: 1.4,
};

const mainAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: "32px",
  overflowY: "auto",
};

const contentStyle: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  display: "grid",
  gap: "24px",
};

const logoutButtonStyle: React.CSSProperties = {
  marginTop: "24px",
  padding: "10px 12px",
  fontSize: "14px",
  borderRadius: "6px",
  border: "1px solid #d0d7e2",
  background: "transparent",
  cursor: "pointer",
};
