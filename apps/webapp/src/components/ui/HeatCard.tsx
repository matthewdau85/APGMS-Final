import React from "react";

export type HeatTone = "warning" | "good";

export interface HeatCardProps {
  tone: HeatTone;
  title: string;
  period: string;
  variance: string;
  confidence: string;
  footer?: React.ReactNode;
}

const toneStyles: Record<HeatTone, { container: string; accent: string }> = {
  warning: {
    container: "bg-amber-50 border border-amber-200",
    accent: "text-amber-700",
  },
  good: {
    container: "bg-emerald-50 border border-emerald-200",
    accent: "text-emerald-700",
  },
};

export const HeatCard: React.FC<HeatCardProps> = ({
  tone,
  title,
  period,
  variance,
  confidence,
  footer,
}) => {
  const styles = toneStyles[tone];
  return (
    <div
      className={`flex flex-col gap-4 rounded-xl p-5 shadow-sm ${styles.container}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{period}</p>
          <h3 className={`text-lg font-semibold ${styles.accent}`}>{title}</h3>
        </div>
      </div>
      <div className="flex items-center gap-6 text-slate-700">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Variance
          </p>
          <p className="text-2xl font-semibold">{variance}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Confidence
          </p>
          <p className="text-2xl font-semibold">{confidence}</p>
        </div>
      </div>
      {footer ? <div className="text-sm text-slate-600">{footer}</div> : null}
    </div>
  );
};

export default HeatCard;
