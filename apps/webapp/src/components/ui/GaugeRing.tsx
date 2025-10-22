import React from "react";

export interface GaugeRingProps {
  value: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
}

const clamp = (val: number) => Math.min(100, Math.max(0, val));

export const GaugeRing: React.FC<GaugeRingProps> = ({
  value,
  label,
  size = 120,
  strokeWidth = 12,
}) => {
  const normalized = clamp(value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <svg
        width={size}
        height={size}
        className="text-slate-200"
        role="img"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalized}
        aria-label={
          label
            ? `${label}: ${Math.round(normalized)} percent`
            : `${Math.round(normalized)} percent`
        }
      >
        <circle
          className="fill-none stroke-current"
          strokeWidth={strokeWidth}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          opacity={0.3}
        />
        <circle
          className="fill-none stroke-emerald-500 transition-all"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-slate-900 text-2xl font-semibold"
        >
          {Math.round(normalized)}%
        </text>
      </svg>
      {label ? (
        <span className="text-sm font-medium text-slate-600">{label}</span>
      ) : null}
    </div>
  );
};

export default GaugeRing;
