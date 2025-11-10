import React, { useEffect, useMemo, useState } from "react";

import {
  evaluateFraudRisk,
  fetchRiskFeedback,
  submitRiskFeedback,
  type RiskAssessment,
} from "../../api";
import { getToken } from "../../auth";

interface FraudRiskPanelProps {
  readonly alerts: Array<{
    id: string;
    severity: string;
    resolved: boolean;
    createdAt: string;
  }>;
}

interface FeedbackEntry {
  readonly id: string;
  readonly label: string;
  readonly override: string | null;
  readonly createdAt: string;
  readonly submittedBy: string;
}

const caseType = "fraud_screening";

export function FraudRiskPanel({ alerts }: FraudRiskPanelProps) {
  const token = getToken();
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);

  const metrics = useMemo(() => computeFraudMetrics(alerts), [alerts]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    async function loadFraudRisk() {
      setLoading(true);
      setError(null);
      try {
        const [riskResponse, feedbackResponse] = await Promise.all([
          evaluateFraudRisk(token, {
            caseId: metrics.caseId,
            velocityScore: metrics.velocityScore,
            patternDeviation: metrics.patternDeviation,
            vendorConcentration: metrics.vendorConcentration,
          }),
          fetchRiskFeedback(token, caseType, metrics.caseId),
        ]);
        if (!cancelled) {
          setRisk(riskResponse.risk);
          setFeedback(
            feedbackResponse.feedback.map((entry) => ({
              id: entry.id,
              label: entry.label,
              override: entry.override,
              createdAt: entry.createdAt,
              submittedBy: entry.submittedBy,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Unable to score fraud risk");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadFraudRisk();
    return () => {
      cancelled = true;
    };
  }, [token, metrics]);

  if (!token) {
    return null;
  }

  async function handleDecision(decision: "hold" | "override") {
    if (!token || !risk) return;
    setSubmitting(true);
    setError(null);
    try {
      const label = decision === "hold" ? "fraud_hold" : "fraud_override";
      const override = decision === "override" ? "manual_clear" : undefined;
      await submitRiskFeedback(token, {
        caseType,
        caseId: metrics.caseId,
        label,
        override,
        modelId: risk.modelId,
        modelVersion: risk.modelVersion,
        score: risk.score,
        metadata: note.trim() ? { note: note.trim() } : undefined,
      });
      const history = await fetchRiskFeedback(token, caseType, metrics.caseId);
      setFeedback(
        history.feedback.map((entry) => ({
          id: entry.id,
          label: entry.label,
          override: entry.override,
          createdAt: entry.createdAt,
          submittedBy: entry.submittedBy,
        })),
      );
      setNote("");
    } catch (err) {
      console.error(err);
      setError("Failed to capture fraud triage decision");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section style={cardStyle}>
      <header style={headerStyle}>
        <div>
          <h2 style={sectionTitleStyle}>Fraud Screening</h2>
          <p style={mutedStyle}>
            Velocity, deviation and vendor concentration scores indicate whether payouts should be blocked.
          </p>
        </div>
        {risk && (
          <span style={{ ...badgeStyle, backgroundColor: risk.requiresManualReview ? "#9a3412" : "#15803d" }}>
            {risk.requiresManualReview ? "Investigate" : "Clear"}
          </span>
        )}
      </header>

      {loading && <div style={infoStyle}>Computing fraud score…</div>}
      {error && <div style={errorStyle}>{error}</div>}

      {risk && !loading && (
        <div style={gridStyle}>
          <div>
            <h3 style={metricTitleStyle}>Risk score</h3>
            <p style={metricValueStyle}>{risk.score.toFixed(2)}</p>
            <p style={mutedStyle}>Threshold {risk.threshold.toFixed(2)}</p>
            <p style={mutedStyle}>
              Confidence {risk.confidenceInterval[0].toFixed(2)} – {risk.confidenceInterval[1].toFixed(2)}
            </p>
          </div>
          <div>
            <h3 style={metricTitleStyle}>Signals</h3>
            <ul style={listStyle}>
              <li>Velocity score: {metrics.velocityScore.toFixed(2)}</li>
              <li>Pattern deviation: {metrics.patternDeviation.toFixed(2)}</li>
              <li>Vendor concentration: {metrics.vendorConcentration.toFixed(2)}</li>
            </ul>
          </div>
          <div>
            <h3 style={metricTitleStyle}>Recommended actions</h3>
            <ul style={listStyle}>
              {risk.recommendedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {risk?.requiresManualReview && (
        <div style={actionContainerStyle}>
          <label style={labelStyle} htmlFor="fraud-note">
            Investigator note
          </label>
          <textarea
            id="fraud-note"
            style={textAreaStyle}
            placeholder="Summarise additional evidence or override rationale"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div style={buttonRowStyle}>
            <button
              type="button"
              style={{ ...buttonStyle, backgroundColor: "#9a3412" }}
              onClick={() => handleDecision("hold")}
              disabled={submitting}
            >
              {submitting ? "Recording…" : "Block payout"}
            </button>
            <button
              type="button"
              style={{ ...buttonStyle, backgroundColor: "#1d4ed8" }}
              onClick={() => handleDecision("override")}
              disabled={submitting}
            >
              {submitting ? "Recording…" : "Override"}
            </button>
          </div>
        </div>
      )}

      {feedback.length > 0 && (
        <div style={historyContainerStyle}>
          <h3 style={metricTitleStyle}>Recent decisions</h3>
          <ul style={historyListStyle}>
            {feedback.map((entry) => (
              <li key={entry.id} style={historyItemStyle}>
                <div>
                  <strong>{entry.label}</strong>
                  {entry.override && <span style={mutedStyle}> • override: {entry.override}</span>}
                </div>
                <span style={mutedStyle}>
                  {new Date(entry.createdAt).toLocaleString()} — {entry.submittedBy}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function computeFraudMetrics(alerts: FraudRiskPanelProps["alerts"]) {
  const unresolved = alerts.filter((alert) => !alert.resolved);
  const highSeverity = unresolved.filter((alert) => alert.severity.toUpperCase() === "HIGH");
  const caseId = unresolved[0]?.id ?? "batch";
  const velocityScore = Math.min(1, alerts.length / 10);
  const patternDeviation = Math.min(1, highSeverity.length / Math.max(unresolved.length || 1, 1));
  const recentWindow = alerts.filter(
    (alert) => Date.now() - new Date(alert.createdAt).getTime() < 1000 * 60 * 60 * 24,
  ).length;
  const vendorConcentration = Math.min(1, recentWindow / 5);
  return { caseId, velocityScore, patternDeviation, vendorConcentration };
}

const cardStyle: React.CSSProperties = {
  padding: "24px",
  borderRadius: "16px",
  border: "1px solid #e5e7eb",
  backgroundColor: "#fff",
  display: "grid",
  gap: "16px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const mutedStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
};

const badgeStyle: React.CSSProperties = {
  color: "#fff",
  fontWeight: 600,
  padding: "6px 12px",
  borderRadius: "999px",
  fontSize: "12px",
  textTransform: "uppercase",
};

const infoStyle: React.CSSProperties = {
  color: "#4b5563",
  fontSize: "14px",
};

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontWeight: 600,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const metricTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  margin: "0 0 8px 0",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  margin: "0 0 8px 0",
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "18px",
  color: "#374151",
  display: "grid",
  gap: "6px",
};

const actionContainerStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  borderTop: "1px solid #e5e7eb",
  paddingTop: "16px",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "14px",
};

const textAreaStyle: React.CSSProperties = {
  minHeight: "70px",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  color: "#fff",
  padding: "10px 18px",
  borderRadius: "999px",
  fontWeight: 600,
  cursor: "pointer",
};

const historyContainerStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "16px",
  display: "grid",
  gap: "10px",
};

const historyListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "8px",
};

const historyItemStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "10px",
  backgroundColor: "#f9fafb",
  display: "grid",
  gap: "4px",
};
