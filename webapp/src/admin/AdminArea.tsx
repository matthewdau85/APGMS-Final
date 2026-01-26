import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useMemo, useState } from "react";

import { AgentPage } from "./pages/AgentPage";
import { RegWatcherPage } from "./pages/RegWatcherPage";

function getAdminTokenFromEnvOrStorage(): string {
  const fromEnv = (import.meta as any).env?.VITE_ADMIN_TOKEN;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  const fromStorage = localStorage.getItem("apgms_admin_token");
  return (fromStorage ?? "").trim();
}

export const AdminArea = () => {
  const [token, setToken] = useState<string>(() => getAdminTokenFromEnvOrStorage());

  const nav = useMemo(() => {
    return [
      { to: "/admin/agent", label: "Agent" },
      { to: "/admin/regwatcher", label: "RegWatcher" },
    ];
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Admin</h1>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, opacity: 0.85 }}>
          x-admin-token:
          <input
            value={token}
            onChange={(e) => {
              const v = e.target.value;
              setToken(v);
              localStorage.setItem("apgms_admin_token", v);
            }}
            placeholder="dev-admin-token"
            style={{
              marginLeft: 8,
              padding: "8px 10px",
              width: 320,
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.2)",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          {nav.map((n) => (
            <Link key={n.to} to={n.to} style={{ textDecoration: "none", fontSize: 13 }}>
              {n.label}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/agent" replace />} />
          <Route path="/agent" element={<AgentPage adminToken={token} />} />
          <Route path="/regwatcher" element={<RegWatcherPage adminToken={token} />} />
          <Route path="*" element={<Navigate to="/admin/agent" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminArea;
