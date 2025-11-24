import React, { useCallback, useEffect, useState } from "react";
import { fetchAlerts, resolveAlert, initiateMfa } from "./api";
import { getToken, getSessionUser } from "./auth";
import { EmptyState, ErrorState, SkeletonBlock, StatusChip } from "./components/UI";

type AlertRecord = Awaited<ReturnType<typeof fetchAlerts>>["alerts"][number];

export default function AlertsPage() {
  const token = getToken();
  const sessionUser = getSessionUser();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAlerts = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await fetchAlerts(token);
        setAlerts(result.alerts);
      } catch (err) {
        console.error(err);
        if (!options?.silent) {
          setError("Unable to load alerts");
        }
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    void loadAlerts();
    const interval = window.setInterval(() => {
      void loadAlerts({ silent: true });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [token, loadAlerts]);

  async function handleResolve(alert: AlertRecord) {
    if (!token) return;
    const note = window.prompt("Add a resolution note for the audit log:", "We transferred the missing GST this morning.") ?? "";
    if (!note.trim()) return;

    setSubmittingId(alert.id);
    setError(null);
    setSuccess(null);

    let resolved = false;
    let requiresMfa = false;

    try {
      await resolveAlert(token, alert.id, note.trim());
      resolved = true;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "mfa_required" &&
        sessionUser?.mfaEnabled &&
        alert.severity.toUpperCase() === "HIGH"
      ) {
        requiresMfa = true;
      } else {
        console.error(err);
        setError("Failed to resolve alert.");
      }
    }

    if (!resolved && requiresMfa) {
      try {
        const challenge = await initiateMfa(token);
        window.alert(`MFA verification required.\n\nDev stub code: ${challenge.code} (expires in ${challenge.expiresInSeconds}s).`);
        const supplied = window.prompt("Enter the MFA code to resolve this high-severity alert:", challenge.code);
        if (!supplied || supplied.trim().length === 0) {
          setError("MFA verification cancelled.");
        } else {
          await resolveAlert(token, alert.id, note.trim(), supplied.trim());
          resolved = true;
        }
      } catch (err) {
        console.error(err);
        setError("MFA verification failed. Please try again.");
      }
    }

    if (resolved) {
      await loadAlerts();
      setSuccess("Alert resolved and logged.");
    }

    setSubmittingId(null);
  }

  if (!token) return null;

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <header>
        <h1 style={pageTitleStyle}>Alerts</h1>
        <p style={pageSubtitleStyle}>
          Real-time compliance alerts flag shortfalls and anomalies that could block BAS lodgment.
        </p>
      </header>

      {loading && (
        <div style={{ display: "grid", gap: 8 }}>
          <SkeletonBlock width="60%" />
          <SkeletonBlock width="100%" height={140} />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={loadAlerts} detail="We could not load alerts right now." />}
      {success && <div style={successTextStyle}>{success}</div>}

      {!loading && !error && (
        <section style={cardStyle}>
          {alerts.length === 0 ? (
            <EmptyState
              title="No open alerts"
              description="Alerts refresh automatically every 15 seconds. Trigger a pre-check or ingest demo data to see the compliance rail light up."
              actionLabel="Refresh now"
              onAction={() => void loadAlerts()}
            />
          ) : (
            <ul style={alertListStyle}>
              {alerts.map((alert) => (
                <li key={alert.id} style={alertRowStyle}>
                  <div style={{ display: "grid", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <StatusChip tone={severityTone(alert.severity)}>{alert.severity.toUpperCase()}</StatusChip>
                      <span style={alertTitleStyle}>{alert.message}</span>
                    </div>
                    <div style={metaTextStyle}>
                      {alert.type} • {new Date(alert.createdAt).toLocaleString()}
                    </div>
                    {alert.resolutionNote && <div style={resolutionNoteStyle}>Note: {alert.resolutionNote}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <StatusChip tone={alert.resolved ? "success" : "warning"}>
                      {alert.resolved ? "Resolved" : "Needs Attention"}
                    </StatusChip>
                    {!alert.resolved && (
                      <button
                        type="button"
                        style={{
                          ...resolveButtonStyle,
                          opacity: submittingId === alert.id ? 0.6 : 1,
                          cursor: submittingId === alert.id ? "wait" : "pointer",
                        }}
                        disabled={submittingId === alert.id}
                        onClick={() => void handleResolve(alert)}
                      >
                        {submittingId === alert.id ? "Resolving..." : "Resolve"}
                      </button>
                    )}
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

function severityTone(severity: string) {
  const upper = severity.toUpperCase();
  if (upper === "HIGH") return "danger";
  if (upper === "MEDIUM") return "warning";
  return "neutral";
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

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
};

const resolutionNoteStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#4b5563",
};

const resolveButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "999px",
  border: "1px solid #d1d5db",
  backgroundColor: "#ffffff",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};
