import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getSessionUser } from "../auth";

const navItems: Array<{ to: string; label: string; description: string }> = [
  {
    to: ".",
    label: "Overview",
    description: "Prototype scope & validation checkpoints",
  },
  {
    to: "onboarding",
    label: "Onboarding flow",
    description: "Simulated customer vetting + cash control",
  },
  {
    to: "risk-review",
    label: "Risk review",
    description: "Live alerts feed mapped to regulator questions",
  },
];

export default function AdminPrototypeLayout() {
  const user = getSessionUser();

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <header style={sidebarHeaderStyle}>
          <span style={prototypeBadgeStyle}>Prototype</span>
          <h1 style={sidebarTitleStyle}>ATO admin walkthrough</h1>
          <p style={sidebarSubtitleStyle}>
            Internal only. Mirrors the APGMS production workflows with
            anonymised ledger data.
          </p>
          {user && (
            <p style={sidebarUserStyle}>
              Signed in as <strong>{user.id}</strong>
            </p>
          )}
        </header>
        <nav style={navStyle}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "."}
              style={({ isActive }) => ({
                padding: "12px 16px",
                borderRadius: "10px",
                display: "grid",
                gap: "4px",
                textDecoration: "none",
                color: isActive ? "#0b5fff" : "#1f2937",
                backgroundColor: isActive ? "rgba(11, 95, 255, 0.08)" : "transparent",
                boxShadow: isActive ? "0 0 0 1px rgba(11, 95, 255, 0.25)" : "none",
                transition: "background 0.2s ease",
              })}
            >
              <span style={{ fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>
                {item.description}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main style={mainStyle}>
        <div style={contentWrapperStyle}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "340px 1fr",
  minHeight: "100vh",
  fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  backgroundColor: "#f8fafc",
};

const sidebarStyle: React.CSSProperties = {
  padding: "32px 28px",
  borderRight: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  display: "flex",
  flexDirection: "column",
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  marginBottom: "32px",
};

const prototypeBadgeStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "4px 8px",
  borderRadius: "999px",
  backgroundColor: "#0b5fff",
  color: "white",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const sidebarTitleStyle: React.CSSProperties = {
  fontSize: "22px",
  margin: 0,
};

const sidebarSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#475569",
  margin: 0,
  lineHeight: 1.4,
};

const sidebarUserStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#1f2937",
  margin: 0,
};

const navStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const mainStyle: React.CSSProperties = {
  padding: "40px 48px",
  overflowY: "auto",
};

const contentWrapperStyle: React.CSSProperties = {
  maxWidth: "960px",
  margin: "0 auto",
  display: "grid",
  gap: "32px",
};
