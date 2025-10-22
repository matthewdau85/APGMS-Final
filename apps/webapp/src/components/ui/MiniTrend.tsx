import React from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

export interface MiniTrendDatum {
  x: number;
  y: number;
}

export interface MiniTrendProps {
  data: MiniTrendDatum[];
  targetPct?: number;
  stroke?: string;
}

const tooltipStyles = {
  backgroundColor: "white",
  border: "1px solid rgba(148, 163, 184, 0.4)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
};

export const MiniTrend: React.FC<MiniTrendProps> = ({
  data,
  targetPct,
  stroke = "#0f172a",
}) => {
  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
          <XAxis dataKey="x" hide type="number" domain={["dataMin", "dataMax"]} />
          <YAxis hide type="number" domain={["dataMin", "dataMax"]} />
          {typeof targetPct === "number" ? (
            <ReferenceLine
              y={targetPct}
              stroke="#22c55e"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="y"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            cursor={{ stroke: "rgba(148, 163, 184, 0.4)", strokeWidth: 1 }}
            wrapperStyle={tooltipStyles}
            labelFormatter={(value) => `Index ${value}`}
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Value"]}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniTrend;
