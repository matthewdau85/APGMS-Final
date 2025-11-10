import React, { useEffect, useMemo, useState } from "react";

import {
  evaluateShortfallRisk,
  fetchRiskFeedback,
  submitRiskFeedback,
  type ComplianceReport,
  type RiskAssessment,
} from "../../api";
import { getToken } from "../../auth";

interface ComplianceRiskPanelProps {
  readonly report: ComplianceReport | null;
}

interface FeedbackEntry {
  readonly id: string;
  readonly label: string;
  readonly override: string | null;
  readonly createdAt: string;
  readonly submittedBy: string;
}

const caseType = "bas_shortfall";

export function ComplianceRiskPanel({ report }: ComplianceRiskPanelProps) {
  const token = getToken();
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const metrics = useMemo(() => computeMetrics(report), [report]);

  useEffect(() => {
    if (!token || !metrics) {
      return;
    }
    let cancelled = false;
    async function loadRisk() {
      setLoading(true);
      setError(null);
      try {
        const [riskResponse, feedbackResponse] = await Promise.all([
          evaluateShortfallRisk(token, {
            basCycleId: metrics.basCycleId ?? undefined,
            cashCoverageRatio: metrics.cashCoverageRatio,
            varianceIndex: metrics.varianceIndex,
            openAlertRatio: metrics.openAlertRatio,
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
          setError("Unable to evaluate BAS readiness risk");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadRisk();
    return () => {
      cancelled = true;
    };
  }, [token, metrics]);

  if (!token || !metrics) {
    return null;
  }

  const showActions = risk && risk.requiresManualReview;

  async function handleDecision(decision: "hold" | "override") {
    if (!token || !risk) return;
    setSubmitting(true);
    setSuccessMessage(null);
    try {
      const label = decision === "hold" ? "manual_hold" : "override_allow";
      const override = decision === "override" ? "approved" : undefined;
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
      setSuccessMessage(
        decision === "hold"
          ? "Risk escalation recorded. Manual confirmation required before BAS release."
          : "Override submitted. BAS release can proceed once funding is confirmed.",
      );
      setNote("");
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
    } catch (err) {
      console.error(err);
      setError("Failed to persist operator decision");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section style={cardStyle}>
      <header style={cardHeaderStyle}>
        <div>
          <h2 style={sectionTitleStyle}>BAS Readiness Risk</h2>
          <p style={mutedStyle}>
            We simulate the shortfall model to determine whether BAS funds can be released automatically.
          </p>
        </div>
        {risk && (
          <span style={{ ...badgeStyle, backgroundColor: risk.requiresManualReview ? "#b91c1c" : "#047857" }}>
            {risk.requiresManualReview ? "Manual review" : "Auto-clear"}
          </span>
        )}
      </header>

      {loading && <div style={infoTextStyle}>Evaluating shortfall exposure…</div>}
      {error && <div style={errorTextStyle}>{error}</div>}
      {successMessage && <div style={successTextStyle}>{successMessage}</div>}

      {risk && !loading && !error && (
        <div style={riskGridStyle}>
          <div>
            <h3 style={metricTitleStyle}>Risk score</h3>
            <p style={metricValueStyle}>{risk.score.toFixed(2)}</p>
            <p style={mutedStyle}>Threshold: {risk.threshold.toFixed(2)}</p>
            <p style={mutedStyle}>
              Confidence interval: {risk.confidenceInterval[0].toFixed(2)} – {risk.confidenceInterval[1].toFixed(2)}
            </p>
          </div>
          <div>
            <h3 style={metricTitleStyle}>Recommended actions</h3>
            <ul style={actionListStyle}>
              {risk.recommendedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 style={metricTitleStyle}>Signals</h3>
            <ul style={actionListStyle}>
              <li>Cash coverage ratio: {metrics.cashCoverageRatio.toFixed(2)}</li>
              <li>Variance index: {metrics.varianceIndex.toFixed(2)}</li>
              <li>Alert ratio: {metrics.openAlertRatio.toFixed(2)}</li>
            </ul>
          </div>
        </div>
      )}

      {showActions && (
        <div style={actionContainerStyle}>
          <label style={labelStyle} htmlFor="compliance-risk-note">
            Operator note (stored for audit)
          </label>
          <textarea
            id="compliance-risk-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Explain mitigation steps or overrides"
            style={textAreaStyle}
          />
          <div style={buttonRowStyle}>
            <button
              type="button"
              style={{ ...primaryButtonStyle, backgroundColor: "#b91c1c" }}
              disabled={submitting}
              onClick={() => handleDecision("hold")}
            >
              {submitting ? "Recording…" : "Escalate and hold"}
            </button>
            <button
              type="button"
              style={{ ...primaryButtonStyle, backgroundColor: "#1d4ed8" }}
              disabled={submitting}
              onClick={() => handleDecision("override")}
            >
              {submitting ? "Recording…" : "Override and proceed"}
            </button>
          </div>
        </div>
      )}

      {feedback.length > 0 && (
        <div style={historyContainerStyle}>
          <h3 style={metricTitleStyle}>Recent operator feedback</h3>
          <ul style={historyListStyle}>
            {feedback.map((entry) => (
              <li key={entry.id} style={historyItemStyle}>
                <div>
                  <strong>{entry.label}</strong>
                  {entry.override && <span style={mutedStyle}> • override: {entry.override}</span>}
                </div>
                <div style={mutedStyle}>
                  {new Date(entry.createdAt).toLocaleString()} — submitted by {entry.submittedBy}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function computeMetrics(report: ComplianceReport | null):
  | { basCycleId: string | null; caseId: string; cashCoverageRatio: number; varianceIndex: number; openAlertRatio: number }
  | null {
  if (!report) {
    return null;
  }
  const latestPlan = report.paymentPlans.find((plan) => plan.status.toUpperCase() !== "RESOLVED");
  const basCycleId = latestPlan?.basCycleId ?? report.basHistory[0]?.period ?? null;
  const totalSecured = report.designatedTotals.paygw + report.designatedTotals.gst;
  const cashCoverageRatio = Math.max(0, Math.min(1, totalSecured / 200000));
  const unsettled = report.basHistory.filter((entry) => entry.status.toLowerCase() !== "lodged");
  const varianceIndex = Math.max(0, Math.min(1, unsettled.length / Math.max(report.basHistory.length || 1, 1)));
  const openAlertRatio = Math.max(0, Math.min(1, report.alertsSummary.openHighSeverity / 5));
  const caseId = basCycleId ?? "aggregate";
  return { basCycleId, caseId, cashCoverageRatio, varianceIndex, openAlertRatio };
}

const cardStyle: React.CSSProperties = {
  padding: "24px",
  borderRadius: "16px",
  border: "1px solid #e5e7eb",
  backgroundColor: "#fff",
  display: "grid",
  gap: "16px",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
};

const badgeStyle: React.CSSProperties = {
  color: "#fff",
  fontWeight: 600,
  padding: "6px 14px",
  borderRadius: "999px",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 700,
};

const mutedStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
  margin: "4px 0",
};

const infoTextStyle: React.CSSProperties = {
  color: "#4b5563",
  fontSize: "14px",
};

const errorTextStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontWeight: 600,
};

const successTextStyle: React.CSSProperties = {
  color: "#047857",
  fontWeight: 600,
};

const metricTitleStyle: React.CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: "16px",
  fontWeight: 600,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  margin: "0 0 8px 0",
};

const riskGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const actionListStyle: React.CSSProperties = {
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

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const labelStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#111827",
};

const textAreaStyle: React.CSSProperties = {
  minHeight: "80px",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  color: "#fff",
  fontWeight: 600,
  borderRadius: "999px",
  padding: "10px 18px",
  cursor: "pointer",
  transition: "opacity 120ms ease",
};

const historyContainerStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "16px",
  display: "grid",
  gap: "12px",
};

const historyListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
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
