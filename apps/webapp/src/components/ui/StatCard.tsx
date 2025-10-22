import React from "react";

export interface StatCardProps {
  title: string;
  subtitle?: string;
  value: string | number;
  subtext?: string;
  rightBadge?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  subtitle,
  value,
  subtext,
  rightBadge,
}) => {
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          {subtitle ? (
            <p className="text-sm font-medium text-slate-500">{subtitle}</p>
          ) : null}
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        {rightBadge ? (
          <div className="shrink-0 text-right text-sm font-medium text-slate-500">
            {rightBadge}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-4xl font-semibold tracking-tight text-slate-900">
          {value}
        </span>
        {subtext ? (
          <p className="text-sm text-slate-500">{subtext}</p>
        ) : null}
      </div>
    </div>
  );
};

export default StatCard;
