"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

// Lightweight cn() so this file never blocks on utils import path.
type CnArg = string | undefined | null | false;
function cn(...inputs: CnArg[]) {
  return inputs.filter(Boolean).join(" ");
}

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType<any>;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs " +
            "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground " +
            "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 " +
            "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border " +
            "[&_.recharts-dot[stroke='#fff']]:stroke-transparent " +
            "[&_.recharts-layer]:outline-none " +
            "[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border " +
            "[&_.recharts-radial-bar-background-sector]:fill-muted " +
            "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted " +
            "[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border " +
            "[&_.recharts-sector[stroke='#fff']]:stroke-transparent " +
            "[&_.recharts-sector]:outline-none " +
            "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, c]) => Boolean(c.theme || c.color)
  );

  if (!colorConfig.length) return null;

  const css = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const vars = colorConfig
        .map(([key, itemConfig]) => {
          const themeMap = (itemConfig as any).theme as
            | Record<string, string>
            | undefined;
          const color =
            themeMap?.[theme as keyof typeof THEMES] || (itemConfig as any).color;
          return color ? `  --color-${key}: ${color};` : null;
        })
        .filter(Boolean)
        .join("\n");

      return `${prefix} [data-chart=${id}] {\n${vars}\n}`;
    })
    .join("\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
};

const ChartTooltip = RechartsPrimitive.Tooltip;
const ChartLegend = RechartsPrimitive.Legend;

// --- Your requested types (kept as-is, then extended safely) ---
type TooltipItem = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
};

type ChartTooltipContentProps = React.HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
};

type LegendItem = {
  value?: string;
  color?: string;
  dataKey?: string;
};

type ChartLegendContentProps = React.HTMLAttributes<HTMLDivElement> & {
  payload?: LegendItem[];
  verticalAlign?: "top" | "middle" | "bottom";
};

// Extend with the extra props your component already uses
type ChartTooltipContentExtraProps = ChartTooltipContentProps & {
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
  labelClassName?: string;
  color?: string;
  labelFormatter?: (label: React.ReactNode, payload: TooltipItem[]) => React.ReactNode;
  formatter?: (
    value: TooltipItem["value"],
    name: TooltipItem["name"],
    item: TooltipItem,
    index: number,
    payload: TooltipItem["payload"]
  ) => React.ReactNode;
};

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentExtraProps
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
      ...divProps
    },
    ref
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) return null;

      const [item] = payload;
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);

      const value =
        !labelKey && typeof label === "string"
          ? (config[label]?.label as any) || label
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        );
      }

      if (!value) return null;
      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) return null;

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
        {...divProps}
      >
        {!nestLabel ? tooltipLabel : null}

        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);

            const raw = (item.payload ?? {}) as Record<string, unknown>;
            const rawFill =
              typeof (raw as any).fill === "string" ? ((raw as any).fill as string) : undefined;

            const indicatorColor = color || rawFill || item.color;

            const valueNode =
              typeof item.value === "number"
                ? item.value.toLocaleString()
                : item.value !== undefined
                ? String(item.value)
                : "";

            return (
              <div
                key={`${key}-${index}`}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                            indicator === "dot" && "h-2.5 w-2.5",
                            indicator === "line" && "w-1",
                            indicator === "dashed" &&
                              "w-0 border-[1.5px] border-dashed bg-transparent",
                            nestLabel && indicator === "dashed" && "my-0.5"
                          )}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}

                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>

                      {valueNode ? (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {valueNode}
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltip";

type ChartLegendContentExtraProps = ChartLegendContentProps & {
  hideIcon?: boolean;
  nameKey?: string;
};

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentExtraProps
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey, ...divProps }, ref) => {
  const { config } = useChart();

  if (!payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
      {...divProps}
    >
      {payload.map((item, idx) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div
            key={`${key}-${item.value || ""}-${idx}`}
            className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className="text-muted-foreground">
              {itemConfig?.label || item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegend";

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: TooltipItem | LegendItem,
  key: string
) {
  // Allow payload.payload[key] indirection (common in Recharts payload objects)
  const raw = (payload as any)?.payload as Record<string, unknown> | undefined;

  const indirect =
    raw && typeof raw[key] === "string" ? (raw[key] as string) : undefined;

  const directKey = key;
  const resolvedKey = indirect || directKey;

  return config[resolvedKey] || config[directKey];
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
};
