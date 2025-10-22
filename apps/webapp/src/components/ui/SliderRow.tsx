import React from "react";

export interface SliderRowProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onValueChange: (value: number) => void;
  id?: string;
}

export const SliderRow: React.FC<SliderRowProps> = ({
  label,
  description,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit,
  onValueChange,
  id,
}) => {
  return (
    <label
      htmlFor={id}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex flex-col">
          <span className="font-medium text-slate-900">{label}</span>
          {description ? (
            <span className="text-xs text-slate-500">{description}</span>
          ) : null}
        </div>
        <span className="text-sm font-semibold text-slate-800">
          {value}
          {unit ? <span className="ml-1 text-xs text-slate-500">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-500"
      />
    </label>
  );
};

export default SliderRow;
