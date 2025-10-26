import React, { useEffect, useState } from "react";
import { fetchAlerts } from "./api";
import { getToken } from "./auth";

type AlertRecord = Awaited<ReturnType<typeof fetchAlerts>>["alerts"][number];

export default function AlertsPage() {
  const token = getToken();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      try {
        const result = await fetchAlerts(token);
        setAlerts(result.alerts);
      } catch (err) {
        console.error(err);
        setError("Unable to load alerts");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (!token) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <header>
        <h1 style={pageTitleStyle}>Alerts</h1>
        <p style={pageSubtitleStyle}>
          Real-time compliance alerts flag shortfalls and anomalies that could block BAS lodgment.
        </p>
      </header>

      {loading && <div style={infoTextStyle}>Loading alerts...</div>}
      {error && <div style={errorTextStyle}>{error}</div>}

      {!loading && !error && (
        <section style={cardStyle}>
          {alerts.length === 0 ? (
            <div style={infoTextStyle}>No alerts to display.</div>
          ) : (
            <ul style={alertListStyle}>
              {alerts.map((alert) => (
                <li key={alert.id} style={alertRowStyle}>
                  <div style={{ display: "grid", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <SeverityBadge severity={alert.severity} />
                      <span style={alertTitleStyle}>{alert.message}</span>
                    </div>
                    <div style={metaTextStyle}>
                      {alert.type} • {new Date(alert.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <ResolvedBadge resolved={alert.resolved} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const palette = severityPalette(severity);
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: palette.background,
        color: palette.text,
      }}
    >
      {severity}
    </span>
  );
}

function ResolvedBadge({ resolved }: { resolved: boolean }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: resolved ? "rgba(16, 185, 129, 0.12)" : "rgba(251, 191, 36, 0.18)",
        color: resolved ? "#047857" : "#92400e",
      }}
    >
      {resolved ? "Resolved" : "Needs Attention"}
    </span>
  );
}

function severityPalette(severity: string) {
  switch (severity.toUpperCase()) {
    case "HIGH":
      return { background: "rgba(239, 68, 68, 0.12)", text: "#b91c1c" };
    case "MEDIUM":
      return { background: "rgba(251, 191, 36, 0.18)", text: "#92400e" };
    case "LOW":
    case "INFO":
      return { background: "rgba(96, 165, 250, 0.18)", text: "#1d4ed8" };
    default:
      return { background: "rgba(107, 114, 128, 0.14)", text: "#374151" };
  }
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

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const alertListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const alertRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "18px 24px",
  borderBottom: "1px solid #f1f5f9",
};

const alertTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#111827",
};

const metaTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#b91c1c",
};
