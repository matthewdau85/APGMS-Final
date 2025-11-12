import type { ReactNode } from "react";

import styles from "./HorizontalBarChart.module.css";

export interface HorizontalBarChartDatum {
  label: string;
  value: number;
  total?: number;
}

export interface HorizontalBarChartProps {
  title?: ReactNode;
  data: HorizontalBarChartDatum[];
  valueFormatter?: (datum: HorizontalBarChartDatum) => ReactNode;
  maxValue?: number;
  className?: string;
}

const defaultFormatter = (datum: HorizontalBarChartDatum) => {
  if (typeof datum.total === "number" && datum.total > 0) {
    const pct = (datum.value / datum.total) * 100;
    return `${datum.value.toLocaleString()} (${pct.toFixed(1)}%)`;
  }

  return datum.value.toLocaleString();
};

export function HorizontalBarChart({
  title,
  data,
  valueFormatter = defaultFormatter,
  maxValue,
  className,
}: HorizontalBarChartProps) {
  const resolvedMax = maxValue ?? Math.max(0, ...data.map((datum) => datum.value));

  const wrapperClassName = className
    ? `${styles.chartWrapper} ${className}`
    : styles.chartWrapper;

  return (
    <div className={wrapperClassName}>
      {title ? <div className={styles.chartTitle}>{title}</div> : null}
      {data.length === 0 ? (
        <div className={styles.emptyState}>No data available.</div>
      ) : (
        data.map((datum) => (
          <div className={styles.barRow} key={datum.label}>
            <span className={styles.barLabel} title={datum.label}>
              {datum.label}
            </span>
            <div className={styles.barTrack} aria-hidden="true">
              <div
                className={styles.barFill}
                style={{
                  width: resolvedMax === 0 ? "0%" : `${Math.round((datum.value / resolvedMax) * 100)}%`,
                }}
              />
            </div>
            <span className={styles.barValue}>{valueFormatter(datum)}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default HorizontalBarChart;
