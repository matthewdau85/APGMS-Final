import { useMemo, useState } from "react";

import type { HorizontalBarChartDatum } from "../../../components/charts/HorizontalBarChart";
import { HorizontalBarChart } from "../../../components/charts/HorizontalBarChart";

import styles from "./BenfordCard.module.css";

export type AdvisorySeverity = "info" | "review" | "alert" | "critical";

export interface AdvisoryMetadataChip {
  label: string;
  value: string;
}

export interface ConcentrationMetricDatum {
  name: string;
  count: number;
  total?: number;
}

export interface BenfordGatewayMetrics {
  vendorConcentration?: ConcentrationMetricDatum[];
  approverConcentration?: ConcentrationMetricDatum[];
}

export interface BenfordAdvisoryDetail {
  summary: string;
  message: string;
  mutedMessage?: string;
  metadata: AdvisoryMetadataChip[];
  severity: AdvisorySeverity;
  showAtoContext?: boolean;
  whyThisMatters?: string;
  metrics: BenfordGatewayMetrics;
}

const toChartDatum = (data: ConcentrationMetricDatum[]): HorizontalBarChartDatum[] =>
  data.map((datum) => ({
    label: datum.name,
    value: datum.count,
    total: datum.total,
  }));

const severityDescriptions: Record<AdvisorySeverity, string> = {
  info: "Monitoring",
  review: "Needs review",
  alert: "Action recommended",
  critical: "Immediate action required",
};

export function BenfordCard({
  summary,
  message,
  mutedMessage,
  metadata = [],
  severity,
  showAtoContext,
  whyThisMatters,
  metrics = { vendorConcentration: [], approverConcentration: [] },
}: BenfordAdvisoryDetail) {
  const [isWhyOpen, setIsWhyOpen] = useState(false);

  const vendorChartData = useMemo(
    () => toChartDatum(metrics.vendorConcentration ?? []),
    [metrics.vendorConcentration],
  );
  const approverChartData = useMemo(
    () => toChartDatum(metrics.approverConcentration ?? []),
    [metrics.approverConcentration],
  );

  const severityLabel = severityDescriptions[severity] ?? "";

  return (
    <article className={styles.card} aria-label={`${severityLabel} Benford advisory`}>
      <header className={styles.header}>
        <div className={styles.summary}>{summary}</div>
        <div className={styles.metadataRow}>
          <span className={styles.metadataChip}>Severity: {severityLabel}</span>
          {showAtoContext ? (
            <span className={styles.metadataChip}>ATO context enabled</span>
          ) : null}
          {metadata.map((chip) => (
            <span className={styles.metadataChip} key={`${chip.label}:${chip.value}`}>
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      </header>

      <div className={styles.message}>{message}</div>

      <div className={styles.detailPanel}>
        <div className={styles.detailColumn}>
          <div className={styles.sectionTitle}>Top vendors by transaction volume</div>
          <HorizontalBarChart data={vendorChartData} />
        </div>
        <div className={styles.detailColumn}>
          <div className={styles.sectionTitle}>Top approvers by release count</div>
          <HorizontalBarChart data={approverChartData} />
        </div>
      </div>

      {mutedMessage ? <div className={styles.mutedMessage}>{mutedMessage}</div> : null}

      {whyThisMatters ? (
        <section className={styles.whyThisMatters} aria-live="polite">
          <button
            type="button"
            className={styles.whyToggleButton}
            onClick={() => setIsWhyOpen((open) => !open)}
            aria-expanded={isWhyOpen}
          >
            <span className={`${styles.arrow} ${isWhyOpen ? styles.arrowOpen : ""}`} aria-hidden="true">
              ▶
            </span>
            Why this matters
          </button>
          {isWhyOpen ? <div className={styles.whyContent}>{whyThisMatters}</div> : null}
        </section>
      ) : null}
    </article>
  );
}

export default BenfordCard;
