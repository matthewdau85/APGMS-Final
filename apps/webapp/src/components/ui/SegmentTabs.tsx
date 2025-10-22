import React from "react";

export interface SegmentTabOption {
  value: string;
  label: string;
  badge?: string | number;
}

export interface SegmentTabsProps {
  options: SegmentTabOption[];
  value: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
}

export const SegmentTabs: React.FC<SegmentTabsProps> = ({
  options,
  value,
  onValueChange,
  ariaLabel,
}) => {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 text-sm"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onValueChange?.(option.value)}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition ${
              isActive
                ? "bg-white text-slate-900 shadow"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>{option.label}</span>
            {option.badge !== undefined ? (
              <span
                className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1 text-xs font-semibold ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-white/60 text-slate-600"
                }`}
              >
                {option.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentTabs;
