import React from "react";

export type Tone = "neutral" | "success" | "warning" | "danger";

export function StatusChip({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return <span className={`app-chip ${tone === "neutral" ? "" : tone}`}>{children}</span>;
}

export function SkeletonBlock({
  width = "100%",
  height = 16,
  style,
}: {
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="app-skeleton"
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
}

export function ErrorState({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, color: "var(--danger)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{message}</div>
      {detail && <div style={{ fontSize: 13, color: "var(--muted)" }}>{detail}</div>}
      {onRetry && (
        <button
          type="button"
          className="app-button ghost"
          style={{ padding: "6px 10px", marginTop: 8, fontSize: 13 }}
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  tone = "neutral",
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  tone?: Tone;
}) {
  const toneColor =
    tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "var(--text)";
  return (
    <div className="app-card" style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: toneColor }}>{value}</div>
      {subtitle && <div style={{ fontSize: 13, color: "var(--muted)" }}>{subtitle}</div>}
    </div>
  );
}

export function ActivityRail({
  items,
}: {
  items: Array<{
    title: string;
    status: "idle" | "loading" | "success" | "error";
    detail?: string;
    meta?: string;
  }>;
}) {
  const toneFor = (status: string): Tone => {
    if (status === "success") return "success";
    if (status === "error") return "danger";
    if (status === "loading") return "warning";
    return "neutral";
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 12,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "#f8fafc",
          }}
        >
          <StatusChip tone={toneFor(item.status)}>{item.status}</StatusChip>
          <div>
            <div style={{ fontWeight: 600 }}>{item.title}</div>
            {item.detail && <div style={{ fontSize: 13, color: "var(--muted)" }}>{item.detail}</div>}
          </div>
          {item.meta && <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.meta}</div>}
        </div>
      ))}
    </div>
  );
}

export function KpiRibbon({
  items,
  columns = 4,
}: {
  items: Array<{ title: string; value: React.ReactNode; subtitle?: string; tone?: Tone }>;
  columns?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(320 / columns)}px, 1fr))`,
        gap: 12,
      }}
    >
      {items.map((item) => (
        <StatCard key={item.title} title={item.title} value={item.value} subtitle={item.subtitle} tone={item.tone} />
      ))}
    </div>
  );
}
