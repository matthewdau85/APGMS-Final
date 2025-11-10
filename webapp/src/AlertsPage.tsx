import React, { useEffect, useState } from "react";
import {
  fetchAlerts,
  resolveAlert,
  initiateMfa,
  type HighRiskDecisionPayload,
} from "./api";
import { getToken, getSessionUser } from "./auth";

type AlertRecord = Awaited<ReturnType<typeof fetchAlerts>>["alerts"][number];

export default function AlertsPage() {
  const token = getToken();
  const sessionUser = getSessionUser();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAlerts = async () => {
    if (!token) {
      return;
    }
    setError(null);
    try {
      const result = await fetchAlerts(token);
      setAlerts(result.alerts);
    } catch (err) {
      console.error(err);
      setError("Unable to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadAlerts();
  }, [token]);

  async function handleResolve(alert: AlertRecord) {
    if (!token) return;
    const note =
      window.prompt(
        "Add a resolution note for the audit log:",
        "We transferred the missing GST this morning."
      ) ?? "";
    if (!note.trim()) {
      return;
    }

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      return;
    }

    const highRisk = alert.severity.toUpperCase() === "HIGH";
    let decisionPayload: HighRiskDecisionPayload | undefined;
    if (highRisk) {
      const reviewerId = window.prompt(
        "Enter reviewer ID/email for approval (required):",
        sessionUser?.email ?? ""
      );
      if (!reviewerId || !reviewerId.trim()) {
        setError("Reviewer approval is required for high-risk alerts.");
        return;
      }

      const reviewerEmail = window.prompt(
        "Reviewer contact email (optional)",
        reviewerId.includes("@") ? reviewerId : ""
      );

      const override = window.confirm(
        "Did the reviewer authorise an override of automated controls?"
      );

      let overrideNote: string | undefined;
      if (override) {
        const overrideInput = window.prompt(
          "Document the override rationale (required)",
          "Confirmed cash top-up from treasury"
        );
        if (!overrideInput || !overrideInput.trim()) {
          setError("Override rationale is required when controls are bypassed.");
          return;
        }
        overrideNote = overrideInput.trim();
      }

      decisionPayload = {
        reviewerId: reviewerId.trim(),
        reviewerEmail: reviewerEmail?.trim() ? reviewerEmail.trim() : undefined,
        approvalStatus: override ? "OVERRIDDEN" : "APPROVED",
        overrideNote,
        decidedAt: new Date().toISOString(),
      };
    }

    setSubmittingId(alert.id);
    setError(null);
    setSuccess(null);

    let resolved = false;
    let requiresMfa = false;
    let decisionResult: Awaited<ReturnType<typeof resolveAlert>>["decision"] = null;

    try {
      const result = await resolveAlert(token, alert.id, {
        note: trimmedNote,
        decision: decisionPayload,
      });
      decisionResult = result.decision;
      resolved = true;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "mfa_required" &&
        sessionUser?.mfaEnabled &&
        highRisk
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
        window.alert(
          `MFA verification required.\n\nDev stub code: ${challenge.code} (expires in ${challenge.expiresInSeconds}s).`
        );
        const supplied = window.prompt(
          "Enter the MFA code to resolve this high-severity alert:",
          challenge.code
        );
        if (!supplied || supplied.trim().length === 0) {
          setError("MFA verification cancelled.");
        } else {
          const result = await resolveAlert(token, alert.id, {
            note: trimmedNote,
            decision: decisionPayload,
            mfaCode: supplied.trim(),
          });
          decisionResult = result.decision;
          resolved = true;
        }
      } catch (err) {
        console.error(err);
        setError("MFA verification failed. Please try again.");
      }
    }

    if (resolved) {
      await loadAlerts();
      if (decisionResult) {
        setSuccess(
          `Alert resolved with reviewer approval recorded (${decisionResult.approvalStatus}).`
        );
      } else {
        setSuccess("Alert resolved and logged.");
      }
    }

    setSubmittingId(null);
  }

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
      {success && <div style={successTextStyle}>{success}</div>}

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
                    {alert.resolutionNote && (
                      <div style={resolutionNoteStyle}>
                        Note: {alert.resolutionNote}
                      </div>
                    )}
                    {alert.decisions.length > 0 && (
                      <div style={decisionTrailStyle}>
                        <div style={decisionTrailHeadingStyle}>Reviewer decisions</div>
                        <ul style={decisionTrailListStyle}>
                          {alert.decisions.map((decision) => (
                            <li key={decision.id} style={decisionTrailItemStyle}>
                              <strong>{decision.approvalStatus}</strong> • {decision.reviewerId}
                              {decision.reviewerEmail && ` (${decision.reviewerEmail})`} –
                              decided {new Date(decision.decidedAt).toLocaleString()}
                              {decision.overrideNote && (
                                <div style={decisionTrailNoteStyle}>
                                  Override note: {decision.overrideNote}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <ResolvedBadge resolved={alert.resolved} />
                    {!alert.resolved && (
                      <button
                        type="button"
                        style={{
                          ...resolveButtonStyle,
                          opacity: submittingId === alert.id ? 0.6 : 1,
                          cursor: submittingId === alert.id ? "wait" : "pointer",
                        }}
                        disabled={submittingId === alert.id}
                        onClick={() => handleResolve(alert)}
                      >
                        {submittingId === alert.id ? "Resolving…" : "Resolve"}
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

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
};

const resolutionNoteStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#4b5563",
};

const decisionTrailStyle: React.CSSProperties = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "8px",
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const decisionTrailHeadingStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#4b5563",
  marginBottom: "8px",
};

const decisionTrailListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: "8px",
};

const decisionTrailItemStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#1f2937",
  lineHeight: 1.4,
};

const decisionTrailNoteStyle: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "12px",
  color: "#6b7280",
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
