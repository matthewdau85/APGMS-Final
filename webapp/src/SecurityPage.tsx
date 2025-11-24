import React, { useCallback, useEffect, useState } from "react";
import { fetchSecurityUsers, initiateMfa, verifyMfa } from "./api";
import { getToken, getSessionUser, updateSession } from "./auth";
import { ErrorState, SkeletonBlock, StatusChip, StatCard } from "./components/UI";

type SecurityUser = Awaited<ReturnType<typeof fetchSecurityUsers>>["users"][number];

export default function SecurityPage() {
  const token = getToken();
  const sessionUser = getSessionUser();
  const [users, setUsers] = useState<SecurityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enableLoading, setEnableLoading] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [enableSuccess, setEnableSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const response = await fetchSecurityUsers(token);
      setUsers(response.users);
    } catch (err) {
      console.error(err);
      setError("Unable to load security settings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void loadUsers();
  }, [token, loadUsers]);

  async function handleEnableMfa() {
    if (!token || !sessionUser) return;
    setEnableLoading(true);
    setEnableError(null);
    setEnableSuccess(null);
    try {
      const challenge = await initiateMfa(token);
      window.alert(`MFA enrolment initiated.\n\nDev stub code: ${challenge.code} (expires in ${challenge.expiresInSeconds}s).`);
      const supplied = window.prompt("Enter the MFA code to finish enabling MFA on your account:", challenge.code);
      if (!supplied || supplied.trim().length === 0) {
        setEnableError("MFA enrolment cancelled.");
        return;
      }
      const verification = await verifyMfa(token, supplied.trim());
      updateSession({ token: verification.token, user: verification.user });
      setEnableSuccess("Multi-factor authentication enabled for your account.");
      const refreshedToken = getToken();
      if (refreshedToken) {
        const response = await fetchSecurityUsers(refreshedToken);
        setUsers(response.users);
      }
    } catch (err) {
      console.error(err);
      setEnableError("Unable to enable MFA. Please try again.");
    } finally {
      setEnableLoading(false);
    }
  }

  if (!token) return null;

  const mfaEnabledCount = users.filter((u) => u.mfaEnabled).length;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header>
        <h1 style={pageTitleStyle}>Security & Access</h1>
        <p style={pageSubtitleStyle}>
          Control who can access APGMS and confirm multi-factor authentication settings before handing credentials to regulators.
        </p>
      </header>

      {loading && (
        <div style={{ display: "grid", gap: 8 }}>
          <SkeletonBlock width="50%" />
          <SkeletonBlock width="100%" height={120} />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={loadUsers} detail="We could not load security settings." />}

      {!loading && !error && (
        <>
          <section style={summaryGridStyle}>
            <StatCard title="Users" value={users.length} />
            <StatCard title="MFA Enabled" value={mfaEnabledCount} tone={mfaEnabledCount === users.length ? "success" : "warning"} />
          </section>

          <section style={cardStyle}>
            <div style={headerRowStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Access List</h2>
                <p style={sectionSubtitleStyle}>Users, roles, and MFA status.</p>
              </div>
              <button type="button" className="app-button" onClick={handleEnableMfa} disabled={enableLoading}>
                {enableLoading ? "Enabling..." : "Enable MFA for me"}
              </button>
            </div>
            {enableError && <ErrorState message={enableError} />}
            {enableSuccess && <div style={successTextStyle}>{enableSuccess}</div>}

            {users.length === 0 ? (
              <div style={infoTextStyle}>No users found.</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>MFA</th>
                    <th style={thStyle}>Created</th>
                    <th style={thStyle}>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td style={tdStyle}>{user.email}</td>
                      <td style={tdStyle}><StatusChip tone="neutral">{user.role}</StatusChip></td>
                      <td style={tdStyle}><StatusChip tone={user.mfaEnabled ? "success" : "warning"}>{user.mfaEnabled ? "Enabled" : "Pending"}</StatusChip></td>
                      <td style={tdStyle}>{new Date(user.createdAt).toLocaleString()}</td>
                      <td style={tdStyle}>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
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
  maxWidth: "600px",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "12px",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
};

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
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

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
};
