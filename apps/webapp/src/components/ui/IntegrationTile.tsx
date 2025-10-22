import React from "react";

type ChipVariant = "default" | "success" | "warning" | "info";

export interface IntegrationTileProps {
  icon?: React.ReactNode;
  systemName: string;
  chipLabel?: string;
  chipVariant?: ChipVariant;
  meta?: Array<{ label: string; value: string }>;
  description?: string;
  onClick?: () => void;
}

const chipStyles: Record<ChipVariant, string> = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-sky-100 text-sky-700",
};

export const IntegrationTile: React.FC<IntegrationTileProps> = ({
  icon,
  systemName,
  chipLabel,
  chipVariant = "default",
  meta,
  description,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-2xl text-slate-600">
        {icon ?? <span aria-hidden>🔗</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-slate-900">{systemName}</h3>
          {chipLabel ? (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipStyles[chipVariant]}`}
            >
              {chipLabel}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="text-sm text-slate-600">{description}</p>
        ) : null}
        {meta && meta.length > 0 ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            {meta.map((item) => (
              <div key={item.label} className="flex gap-1">
                <dt className="font-medium text-slate-600">{item.label}:</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </button>
  );
};

export default IntegrationTile;
