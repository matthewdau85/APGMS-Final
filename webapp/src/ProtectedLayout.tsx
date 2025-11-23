import React, { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearToken, getToken } from "./auth";
import { useTheme, type ThemeName } from "./theme";

const navItems: Array<{ to: string; label: string }> = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/feeds", label: "Payroll & GST Feeds" },
  { to: "/alerts", label: "Alerts" },
  { to: "/bas", label: "BAS Lodgment" },
  { to: "/compliance", label: "Compliance" },
  { to: "/demo", label: "Demo mode" },
  { to: "/security", label: "Security / Access" },
];

export default function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getToken();
  const { theme, setTheme } = useTheme();

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

  const summaryChips = [
    { label: "PAYGW coverage OK", tone: "success" },
    { label: "GST shortfall detected", tone: "warning" },
    { label: "Next BAS due 15 Dec", tone: "neutral" },
  ];

  const activityItems = [
    { title: "Evidence pack generated", meta: "2m ago • pack #4821" },
    { title: "PAYGW shortfall alert", meta: "10m ago • escalated" },
    { title: "Regulator view opened", meta: "21m ago • sandbox" },
  ];

  return (
    <div style={outerShellStyle}>
      <aside style={sidebarStyle}>
        <div>
          <div style={brandStyle}>
            <div>APGMS Admin</div>
            <div style={envBadgeStyle}>Sandbox</div>
          </div>
          <div style={orgStyle}>Org: demo-org</div>
          <div style={{ margin: "12px 0" }}>
            <label style={themeLabelStyle}>
              Theme
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeName)}
                style={themeSelectStyle}
              >
                <option value="navy">Navy</option>
                <option value="sunset">Sunset</option>
                <option value="forest">Forest</option>
              </select>
            </label>
          </div>
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
                  color: isActive ? "var(--accent)" : "var(--nav-text)",
                  backgroundColor: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  textDecoration: "none",
                  fontWeight: isActive ? 700 : 500,
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div style={quickActionsStyle}>
            <button type="button" className="app-button" style={{ width: "100%" }}>
              Run precheck
            </button>
            <button type="button" className="app-button ghost" style={{ width: "100%" }}>
              Generate evidence
            </button>
            <button type="button" className="app-button ghost" style={{ width: "100%" }}>
              Trigger demo feed
            </button>
          </div>
        </div>
        <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
          Log out
        </button>
      </aside>

      <main style={mainAreaStyle}>
        <div style={summaryRibbonStyle}>
          <div style={summaryLeftStyle}>
            <div style={summaryTitleStyle}>Compliance Control Room</div>
            <div style={summarySubStyle}>
              PAYGW/GST coverage, BAS readiness, and evidence status at a glance.
            </div>
            <div style={chipRowStyle}>
              {summaryChips.map((chip) => (
                <span
                  key={chip.label}
                  className={`app-chip ${chip.tone === "neutral" ? "" : chip.tone}`}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
          <div style={summaryActionsStyle}>
            <button type="button" className="app-button">
              Run pre-check
            </button>
            <button type="button" className="app-button ghost">
              Download evidence
            </button>
          </div>
        </div>
        <div style={contentShellStyle}>
          <div style={contentStyle}>
            <Outlet />
          </div>
          <aside style={activityRailStyle}>
            <div style={railHeaderStyle}>Activity / Alerts</div>
            <div style={railListStyle}>
              {activityItems.map((item) => (
                <div key={item.title} style={railItemStyle}>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.meta}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

const outerShellStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  fontFamily: "var(--font-body)",
  backgroundColor: "var(--bg)",
};

const sidebarStyle: React.CSSProperties = {
  width: "240px",
  padding: "24px 20px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  borderRight: "1px solid var(--border)",
  backgroundColor: "var(--nav-bg)",
  color: "var(--nav-text)",
};

const brandStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  marginBottom: "24px",
  color: "var(--nav-text)",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const mainAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: "24px 32px 32px",
  overflowY: "auto",
};

const contentStyle: React.CSSProperties = {
  maxWidth: "980px",
  display: "grid",
  gap: "20px",
};

const logoutButtonStyle: React.CSSProperties = {
  marginTop: "24px",
  padding: "10px 12px",
  fontSize: "14px",
  borderRadius: "6px",
  border: "1px solid rgba(255,255,255,0.3)",
  background: "transparent",
  color: "var(--nav-text)",
  cursor: "pointer",
};

const envBadgeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  color: "var(--nav-text)",
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.2)",
};

const orgStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--nav-text)",
  marginBottom: 16,
};

const themeLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  color: "var(--nav-text)",
  fontSize: 13,
  fontWeight: 600,
};

const themeSelectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "var(--nav-text)",
};

const quickActionsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 16,
};

const summaryRibbonStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "16px 18px",
  boxShadow: "var(--shadow-soft)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const summaryLeftStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const summaryTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: 18,
  fontWeight: 700,
  margin: 0,
};

const summarySubStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 14,
};

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const summaryActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const contentShellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 280px",
  gap: 16,
  alignItems: "start",
};

const activityRailStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: 14,
  boxShadow: "var(--shadow-soft)",
  position: "sticky",
  top: 20,
  height: "fit-content",
  minHeight: 240,
};

const railHeaderStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 10,
};

const railListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const railItemStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-alt)",
  boxShadow: "var(--shadow-soft)",
};
