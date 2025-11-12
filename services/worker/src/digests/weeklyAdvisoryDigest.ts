export type AdvisorySeverityLevel = "info" | "monitor" | "review" | "alert" | "critical";

export interface WeeklyAdvisoryDigestInput {
  summaryLine: string;
  severity: AdvisorySeverityLevel;
  showAtoContext?: boolean;
  additionalNotes?: string[];
}

const severityRank: Record<AdvisorySeverityLevel, number> = {
  info: 0,
  monitor: 0,
  review: 1,
  alert: 2,
  critical: 3,
};

const weeklyAdvisoryPrefix = "Weekly advisory";

export function generateWeeklyAdvisoryDigest({
  summaryLine,
  severity,
  showAtoContext = false,
  additionalNotes = [],
}: WeeklyAdvisoryDigestInput): string[] {
  const digestLines: string[] = [];

  if (summaryLine) {
    if (showAtoContext && (severityRank[severity] ?? 0) >= severityRank.review) {
      digestLines.push(`${weeklyAdvisoryPrefix}: ${summaryLine}`);
    } else {
      digestLines.push(summaryLine);
    }
  }

  for (const note of additionalNotes) {
    if (note && note.trim().length > 0) {
      digestLines.push(note.trim());
    }
  }

  return digestLines;
}
