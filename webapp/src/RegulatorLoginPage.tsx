import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { regulatorLogin } from "./api";
import { saveRegulatorSession } from "./regulatorAuth";

export default function RegulatorLoginPage() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [orgId, setOrgId] = useState("dev-org");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await regulatorLogin(accessCode, orgId);
      saveRegulatorSession({
        token: result.token,
        orgId: result.orgId,
        session: result.session,
      });
      navigate("/regulator/portal/overview", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message.replace(/_/g, " ") : "login_failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>APGMS Regulator Login</h1>
        <p style={subtitleStyle}>
          Use the short-lived access code issued for sandbox review.
        </p>
        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            <span>Access code</span>
            <input
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Enter access code"
              style={inputStyle}
              autoComplete="one-time-code"
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Organisation ID</span>
            <input
              value={orgId}
              onChange={(event) => setOrgId(event.target.value)}
              placeholder="dev-org"
              style={inputStyle}
            />
            <span style={helperTextStyle}>
              Default is <code>dev-org</code>; override to inspect another tenant.
            </span>
          </label>
          {error ? (
            <div style={errorStyle}>
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...submitButtonStyle,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <div style={footerStyle}>
          <Link to="/" style={linkStyle}>
            Back to admin portal
          </Link>
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 60%, #ffffff 100%)",
  padding: "32px",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  background: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  padding: "32px",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "grid",
  gap: "20px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#475569",
  margin: 0,
  lineHeight: 1.5,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  fontSize: "14px",
  color: "#1e293b",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5f5",
  fontSize: "14px",
};

const helperTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
};

const errorStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#b91c1c",
  background: "#fee2e2",
  padding: "10px 12px",
  borderRadius: "8px",
};

const submitButtonStyle: React.CSSProperties = {
  background: "#0b5fff",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "12px",
  fontSize: "15px",
  fontWeight: 600,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "13px",
  color: "#64748b",
};

const linkStyle: React.CSSProperties = {
  color: "#0b5fff",
  textDecoration: "none",
  fontWeight: 500,
};
