import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { listRiskDecisions, submitFraudDecision } from "../../api";

const panelStyle: CSSProperties = {
  border: "1px solid #f1f5f9",
  borderRadius: "12px",
  padding: "20px",
  background: "#ffffff",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
  marginTop: "24px"
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "12px"
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #cbd5f5"
};

type FraudReviewPanelProps = {
  token: string;
};

type FraudDecision = {
  id: string;
  decision: string;
  createdAt: string;
  score: number;
  recommendation: string;
};

const defaultMetrics = {
  amount: 0.45,
  velocity: 0.32,
  geoRisk: 0.2
};

export function FraudReviewPanel({ token }: FraudReviewPanelProps) {
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [decision, setDecision] = useState<"approve" | "block">("block");
  const [result, setResult] = useState<any | null>(null);
  const [history, setHistory] = useState<FraudDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await listRiskDecisions(token, "fraud_review", 8);
      setHistory(res.decisions ?? []);
    } catch (err) {
      console.warn("Failed to load fraud decision history", err);
    }
  }, [token]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const evaluate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await submitFraudDecision(token, {
        transactionId: `txn-${Date.now()}`,
        metrics,
        decision,
        rationale: decision === "approve" ? "Manual override by reviewer" : undefined
      });
      setResult(res);
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete fraud review");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>Fraud Escalation Workbench</h2>
      <p style={{ color: "#475569" }}>
        Compare model thresholds against investigator judgement to document overrides and escalation paths.
      </p>

      <div style={gridStyle}>
        <MetricInput
          label="Amount Risk"
          value={metrics.amount}
          onChange={(value) => setMetrics((prev) => ({ ...prev, amount: value }))}
        />
        <MetricInput
          label="Velocity Risk"
          value={metrics.velocity}
          onChange={(value) => setMetrics((prev) => ({ ...prev, velocity: value }))}
        />
        <MetricInput
          label="Geo Risk"
          value={metrics.geoRisk}
          onChange={(value) => setMetrics((prev) => ({ ...prev, geoRisk: value }))}
        />
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <button
          style={{ ...buttonStyle(decision === "approve"), background: "#0f766e" }}
          onClick={() => setDecision("approve")}
        >
          Approve
        </button>
        <button
          style={{ ...buttonStyle(decision === "block"), background: "#b91c1c" }}
          onClick={() => setDecision("block")}
        >
          Block
        </button>
        <button
          style={{ ...buttonStyle(true), background: "#1d4ed8" }}
          onClick={() => void evaluate()}
          disabled={loading}
        >
          {loading ? "Evaluating..." : "Run Review"}
        </button>
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: "12px" }}>{error}</div>}

      {result && (
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "12px" }}>
          <div>
            <strong>Model score:</strong> {(result.evaluation?.score ?? 0).toFixed(3)} (threshold {result.threshold})
          </div>
          <div style={{ marginTop: "8px" }}>
            <strong>Recommendation:</strong> {result.evaluation?.recommendation}
          </div>
          <div style={{ marginTop: "8px" }}>
            <strong>Operator decision:</strong> {result.operatorDecision?.decision} ·
            {result.operatorDecision?.approved ? " approved" : " requires override"}
          </div>
          <div style={{ marginTop: "12px" }}>
            <h4 style={{ marginBottom: "6px" }}>Top signals</h4>
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              {(result.evaluation?.contributions ?? []).slice(0, 3).map((entry: any) => (
                <li key={entry.feature}>
                  {entry.feature}: {(entry.contribution * 100).toFixed(1)} basis points impact
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div style={{ marginTop: "18px" }}>
        <h3 style={{ marginBottom: "6px" }}>Recent fraud decisions</h3>
        {history.length === 0 && <div style={{ color: "#475569" }}>No fraud reviews completed yet.</div>}
        {history.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {history.map((entry) => (
              <li key={entry.id}>
                {entry.decision.toUpperCase()} — score {(entry.score * 100).toFixed(1)} · {entry.recommendation} ·
                {" "}
                {new Date(entry.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type MetricInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function MetricInput({ label, value, onChange }: MetricInputProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>{label}</span>
      <input
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={inputStyle}
      />
    </label>
  );
}

function buttonStyle(active: boolean): CSSProperties {
  return {
    border: "none",
    color: "white",
    padding: "10px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    opacity: active ? 1 : 0.8,
    fontWeight: 600
  };
}
