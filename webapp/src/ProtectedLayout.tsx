import React, { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearToken, getToken } from "./auth";

const navItems: Array<{ to: string; label: string }> = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/feeds", label: "Payroll & GST Feeds" },
  { to: "/alerts", label: "Alerts" },
  { to: "/bas", label: "BAS Lodgment" },
  { to: "/payment-plans", label: "Payment plans" },
  { to: "/compliance", label: "Compliance" },
  { to: "/demo", label: "Demo mode" },
  { to: "/security", label: "Security / Access" },
];

export default function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getToken();

  useEffect(() => {
    if (!token) {
      navigate("/", { replace: true, state: { from: location.pathname } });
    }
  }, [token, navigate, location.pathname]);

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
          <nav style={{ display: "grid", gap: "8px" }}>
            {navItems.map((item) => (
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
