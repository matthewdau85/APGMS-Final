import React from "react";

export type VarianceBadgeVariant = "success" | "warning" | "danger" | "info";

export interface VarianceBadgeProps {
  label: string;
  variant?: VarianceBadgeVariant;
  percentage?: number;
  className?: string;
}

const variantStyles: Record<VarianceBadgeVariant, string> = {
  success:
    "bg-emerald-100 text-emerald-700 border border-emerald-200",
  warning:
    "bg-amber-100 text-amber-800 border border-amber-200",
  danger: "bg-rose-100 text-rose-700 border border-rose-200",
  info: "bg-sky-100 text-sky-700 border border-sky-200",
};

export const VarianceBadge: React.FC<VarianceBadgeProps> = ({
  label,
  variant = "info",
  percentage,
  className,
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${variantStyles[variant]} ${className ?? ""}`.trim()}
    >
      {label}
      {typeof percentage === "number" && !Number.isNaN(percentage) ? (
        <span className="text-xs font-semibold opacity-80">
          {percentage > 0 ? "+" : ""}
          {percentage.toFixed(1)}%
        </span>
      ) : null}
    </span>
  );
};

export default VarianceBadge;
