import React from "react";

type GapSize = "sm" | "md" | "lg";

export interface KpiGroupProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: GapSize;
  className?: string;
}

const gapMap: Record<GapSize, string> = {
  sm: "gap-3",
  md: "gap-5",
  lg: "gap-8",
};

export const KpiGroup: React.FC<KpiGroupProps> = ({
  children,
  columns = 3,
  gap = "md",
  className,
}) => {
  const columnClass =
    columns === 4
      ? "md:grid-cols-2 xl:grid-cols-4"
      : columns === 2
        ? "md:grid-cols-2"
        : columns === 1
          ? "grid-cols-1"
          : "md:grid-cols-3";

  return (
    <div
      className={`grid grid-cols-1 ${columnClass} ${gapMap[gap]} ${
        className ?? ""
      }`.trim()}
    >
      {children}
    </div>
  );
};

export default KpiGroup;
