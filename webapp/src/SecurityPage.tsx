import React, { useEffect, useState } from "react";
import { fetchSecurityUsers } from "./api";
import { getToken } from "./auth";

type SecurityUser = Awaited<ReturnType<typeof fetchSecurityUsers>>["users"][number];

export default function SecurityPage() {
  const token = getToken();
  const [users, setUsers] = useState<SecurityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      try {
        const response = await fetchSecurityUsers(token);
        setUsers(response.users);
      } catch (err) {
        console.error(err);
        setError("Unable to load security settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (!token) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header>
        <h1 style={pageTitleStyle}>Security & Access</h1>
        <p style={pageSubtitleStyle}>
          Control who can access APGMS and confirm multi-factor authentication settings before handing credentials to regulators.
        </p>
      </header>

      {loading && <div style={infoTextStyle}>Loading security roster...</div>}
      {error && <div style={errorTextStyle}>{error}</div>}

      {!loading && !error && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Administrators</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>User ID</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>MFA</th>
                <th style={thStyle}>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={tdStyle}>{user.id}</td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>
                    <span style={roleBadgeStyle}>{user.role}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={user.mfaEnabled ? mfaOnBadgeStyle : mfaOffBadgeStyle}>
                      {user.mfaEnabled ? "Enabled" : "MFA OFF"}
                    </span>
                  </td>
                  <td style={tdStyle}>{new Date(user.lastLogin).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div style={infoTextStyle}>No users found for this org.</div>}
        </section>
      )}
    </div>
  );
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  marginBottom: "8px",
};

const pageSubtitleStyle: React.CSSProperties = {
  color: "#4b5563",
  margin: 0,
  fontSize: "14px",
  maxWidth: "620px",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#b91c1c",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "24px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6b7280",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "14px",
  borderBottom: "1px solid #f1f5f9",
  color: "#111827",
};

const roleBadgeStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "20px",
  backgroundColor: "rgba(59, 130, 246, 0.12)",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const mfaOnBadgeStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "20px",
  backgroundColor: "rgba(16, 185, 129, 0.12)",
  color: "#047857",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
};

const mfaOffBadgeStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "20px",
  backgroundColor: "rgba(239, 68, 68, 0.12)",
  color: "#b91c1c",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
};
