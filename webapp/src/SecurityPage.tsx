import React, { useEffect, useState } from "react";
import { fetchSecurityUsers, initiateMfa, verifyMfa } from "./api";
import { getToken, getSessionUser, updateSession } from "./auth";

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

  async function handleEnableMfa() {
    if (!token || !sessionUser) {
      return;
    }
    setEnableLoading(true);
    setEnableError(null);
    setEnableSuccess(null);
    try {
      const challenge = await initiateMfa(token);
      window.alert(
        `MFA enrolment initiated.\n\nDev stub code: ${challenge.code} (expires in ${challenge.expiresInSeconds}s).`
      );
      const supplied = window.prompt(
        "Enter the MFA code to finish enabling MFA on your account:",
        challenge.code
      );
      if (!supplied || supplied.trim().length === 0) {
        setEnableError("MFA enrolment cancelled.");
        return;
      }
      const verification = await verifyMfa(token, supplied.trim());
      updateSession({
        token: verification.token,
        user: verification.user,
        prototypeEnv: verification.prototypeEnv,
      });
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

      {!loading && !error && sessionUser && (
        <section style={enrolCardStyle}>
          <div style={{ display: "grid", gap: "6px" }}>
            <h2 style={sectionTitleStyle}>Your MFA status</h2>
            <p style={pageSubtitleStyle}>
              MFA protects high-risk actions like BAS lodgment and high-severity alert resolution. Enable it before pilot handover.
            </p>
            {enableError && <span style={errorTextStyle}>{enableError}</span>}
            {enableSuccess && <span style={successTextStyle}>{enableSuccess}</span>}
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={sessionUser.mfaEnabled ? mfaOnBadgeStyle : mfaOffBadgeStyle}>
              {sessionUser.mfaEnabled ? "Enabled" : "MFA OFF"}
            </span>
            {!sessionUser.mfaEnabled && (
              <button
                type="button"
                onClick={handleEnableMfa}
                style={enableMfaButtonStyle}
                disabled={enableLoading}
              >
                {enableLoading ? "Enabling..." : "Enable MFA (beta)"}
              </button>
            )}
          </div>
        </section>
      )}

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

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
};

const enrolCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px 24px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
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

const enableMfaButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid #1d4ed8",
  backgroundColor: "#1d4ed8",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};
