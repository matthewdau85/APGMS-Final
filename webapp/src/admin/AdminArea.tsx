import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AdminArea() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <Link
        to="/proto/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          textDecoration: "none",
          color: "inherit",
          background: "rgba(255,255,255,0.08)",
          fontWeight: 700,
        }}
      >
        Open APGMS Console (Demo Mode)
      </Link>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Prototype console is admin-only and uses deterministic mocked data with periodic incoming feed simulation.
      </div>
    </div>
  );
}
