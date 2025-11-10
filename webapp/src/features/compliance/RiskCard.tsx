import React from "react";
import type { RiskAssessment } from "./riskTypes";
import { formatScore, getPalette, shouldHighlight, summariseExplanations } from "./riskUtils";

interface Props {
  readonly title: string;
  readonly assessment: RiskAssessment | null;
}

export function RiskCard({ title, assessment }: Props) {
  const level = assessment?.riskLevel ?? "low";
  const palette = getPalette(level);
  const explanations = summariseExplanations(assessment);

  return (
    <article
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "16px",
        display: "grid",
        gap: "8px",
        background: "#fff",
        boxShadow: shouldHighlight(level) ? "0 4px 20px rgba(234, 67, 53, 0.1)" : "none",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>{title}</h3>
          <p style={{ margin: 0, color: "#4a5568", fontSize: "0.9rem" }}>
            {assessment ? assessment.recommendedAction : "Waiting for signal from ML service."}
          </p>
        </div>
        <div
          style={{
            minWidth: "96px",
            textAlign: "center",
            padding: "8px 12px",
            borderRadius: "999px",
            background: palette.accent,
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {assessment ? formatScore(assessment.score) : "N/A"}
          <div style={{ fontSize: "0.75rem", letterSpacing: "0.04em" }}>{palette.label} risk</div>
        </div>
      </header>
      <ul style={{ margin: 0, paddingLeft: "18px", color: "#2d3748", fontSize: "0.95rem" }}>
        {explanations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

export default RiskCard;
