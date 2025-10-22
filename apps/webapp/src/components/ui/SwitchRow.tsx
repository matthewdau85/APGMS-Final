import React from "react";

export interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export const SwitchRow: React.FC<SwitchRowProps> = ({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}) => {
  const handleToggle = () => {
    if (disabled) return;
    onCheckedChange(!checked);
  };

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 ${
        disabled ? "opacity-60" : "cursor-pointer"
      }`}
      onClick={handleToggle}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleToggle();
        }
      }}
      aria-disabled={disabled}
    >
      <span className="flex flex-col" id={id ? `${id}-label` : undefined}>
        <span className="text-sm font-medium text-slate-900">{label}</span>
        {description ? (
          <span className="text-xs text-slate-500">{description}</span>
        ) : null}
      </span>
      <span className="mt-1 inline-flex items-center">
        <span
          role="switch"
          aria-checked={checked}
          aria-labelledby={id ? `${id}-label` : undefined}
          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
            checked
              ? "border-emerald-500 bg-emerald-500"
              : "border-slate-300 bg-slate-200"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </span>
    </div>
  );
};

export default SwitchRow;
