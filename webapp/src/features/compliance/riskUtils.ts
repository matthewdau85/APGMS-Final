import type { RiskAssessment, RiskLevel } from "./riskTypes";

export interface RiskPalette {
  label: string;
  tone: "success" | "warning" | "danger";
  accent: string;
}

const paletteByLevel: Record<RiskLevel, RiskPalette> = {
  low: { label: "Low", tone: "success", accent: "#0f9d58" },
  medium: { label: "Medium", tone: "warning", accent: "#fbbc05" },
  high: { label: "High", tone: "danger", accent: "#ea4335" },
};

export function getPalette(level: RiskLevel): RiskPalette {
  return paletteByLevel[level];
}

export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function summariseExplanations(assessment: RiskAssessment | null): string[] {
  if (!assessment) {
    return ["Model did not return a signal."];
  }
  if (assessment.explanations.length === 0) {
    return ["No contributing factors were surfaced."];
  }
  return assessment.explanations.slice(0, 3);
}

export function shouldHighlight(level: RiskLevel): boolean {
  return level !== "low";
}
