import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ComplianceMetricsPayload,
  fetchCompliancePlan,
  listPlanDecisions,
  submitComplianceDecision
} from "../../api";

const panelStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "20px",
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
  marginTop: "24px"
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "16px"
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "16px",
  marginBottom: "16px"
};

const metricCardStyle: CSSProperties = {
  border: "1px solid #cbd5f5",
  borderRadius: "10px",
  padding: "12px",
  background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)"
};

const tasksStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px"
};

const taskCardStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: "10px",
  padding: "12px",
  background: "#f8fafc"
};

const decisionBarStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  marginTop: "16px"
};

const buttonStyle: CSSProperties = {
  borderRadius: "8px",
  border: "none",
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer"
};

type DecisionRecord = {
  id: string;
  decision: string;
  recommendation: string;
  createdAt: string;
  rationale?: string | null;
};

type ComplianceGovernancePanelProps = {
  token: string;
};

const defaultMetrics: ComplianceMetricsPayload["metrics"] = {
  controlCoverage: 0.82,
  openFindings: 0.18,
  trainingCompletion: 0.75
};

function percent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function ComplianceGovernancePanel({ token }: ComplianceGovernancePanelProps) {
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const payload = useMemo<ComplianceMetricsPayload>(() => ({ metrics }), [metrics]);

  const refreshPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCompliancePlan(token, payload);
      setPlan(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch plan");
    } finally {
      setLoading(false);
    }
  }, [token, payload]);

  const refreshDecisions = useCallback(async () => {
    try {
      const result = await listPlanDecisions(token, "compliance_plan", 10);
      setDecisions(result.decisions ?? []);
    } catch (err) {
      console.warn("Failed to load compliance decision log", err);
    }
  }, [token]);

  useEffect(() => {
    void refreshPlan();
    void refreshDecisions();
  }, [refreshPlan, refreshDecisions]);

  const adoptPlan = async (decision: "adopt" | "defer") => {
    if (!plan) return;
    setSubmitting(true);
    try {
      await submitComplianceDecision(token, {
        ...payload,
        decision,
        planId: plan.plan?.model?.version,
        rationale:
          decision === "defer"
            ? "Follow-up required on outstanding regulator findings"
            : undefined
      });
      await refreshPlan();
      await refreshDecisions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to persist decision");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ fontSize: "20px", margin: 0 }}>Compliance Readiness Insights</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            ML-assisted maturity scoring tracks operational control health and required remediation.
          </p>
        </div>
        <button
          style={{ ...buttonStyle, background: "#1d4ed8", color: "white" }}
          onClick={() => void refreshPlan()}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Re-score"}
        </button>
      </div>

      <div style={metricGridStyle}>
        <MetricCard label="Control Coverage" value={percent(metrics.controlCoverage)}>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={metrics.controlCoverage}
            onChange={(e) =>
              setMetrics((prev) => ({ ...prev, controlCoverage: Number(e.target.value) }))
            }
            style={{ width: "100%", marginTop: "8px" }}
          />
        </MetricCard>
        <MetricCard label="Open Findings" value={percent(metrics.openFindings)}>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={metrics.openFindings}
            onChange={(e) => setMetrics((prev) => ({ ...prev, openFindings: Number(e.target.value) }))}
            style={{ width: "100%", marginTop: "8px" }}
          />
        </MetricCard>
        <MetricCard label="Training Completion" value={percent(metrics.trainingCompletion)}>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={metrics.trainingCompletion}
            onChange={(e) =>
              setMetrics((prev) => ({ ...prev, trainingCompletion: Number(e.target.value) }))
            }
            style={{ width: "100%", marginTop: "8px" }}
          />
        </MetricCard>
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: "12px" }}>{error}</div>}

      {plan && plan.plan && (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <strong>Score:</strong> {(plan.plan.score * 100).toFixed(1)} (threshold {plan.threshold}) ·
            <strong style={{ marginLeft: "6px" }}>
              {plan.attention ? "Action required" : "On track"}
            </strong>
          </div>
          <div style={tasksStyle}>
            {plan.plan.tasks.map((task: any) => (
              <div key={task.title} style={taskCardStyle}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>{task.title}</div>
                <div style={{ fontSize: "12px", color: "#475569" }}>{task.context}</div>
                <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: 500 }}>
                  Status: {task.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          <div style={decisionBarStyle}>
            <button
              style={{ ...buttonStyle, background: "#0f766e", color: "white" }}
              onClick={() => void adoptPlan("adopt")}
              disabled={submitting}
            >
              Adopt Plan
            </button>
            <button
              style={{ ...buttonStyle, background: "#b91c1c", color: "white" }}
              onClick={() => void adoptPlan("defer")}
              disabled={submitting}
            >
              Defer & Capture Rationale
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <h3 style={{ marginBottom: "8px" }}>Latest Reviewer Decisions</h3>
        {decisions.length === 0 && <div style={{ color: "#475569" }}>No compliance plan actions captured yet.</div>}
        {decisions.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            {decisions.map((entry) => (
              <li key={entry.id} style={{ marginBottom: "6px" }}>
                <strong>{entry.decision.toUpperCase()}</strong> · {new Date(entry.createdAt).toLocaleString()} ·
                Recommendation: {entry.recommendation}
                {entry.rationale && <span> — {entry.rationale}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  children?: React.ReactNode;
};

function MetricCard({ label, value, children }: MetricCardProps) {
  return (
    <div style={metricCardStyle}>
      <div style={{ fontSize: "12px", color: "#475569" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 700 }}>{value}</div>
      {children}
    </div>
  );
}
