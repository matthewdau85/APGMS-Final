import React from "react";
import type { ComplianceRiskInsights } from "./riskTypes";
import RiskCard from "./RiskCard";

interface Props {
  readonly insights: ComplianceRiskInsights | null;
}

export function RiskSummary({ insights }: Props) {
  if (!insights) {
    return null;
  }

  return (
    <section style={{ display: "grid", gap: "16px" }}>
      <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Machine learning insights</h2>
      <p style={{ margin: 0, color: "#4a5568" }}>
        Scores update whenever we ingest ledger activity or compliance alerts. Use these recommendations to
        prioritise interventions before the BAS window closes.
      </p>
      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <RiskCard title="Shortfall risk" assessment={insights.shortfall} />
        <RiskCard title="Fraud risk" assessment={insights.fraud} />
      </div>
    </section>
  );
}

export default RiskSummary;
