import React from "react";

type Tone = "neutral" | "success" | "warning" | "danger";

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

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        border: "1px dashed var(--border)",
        borderRadius: 12,
        padding: 16,
        background: "var(--surface)",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: "var(--muted)" }}>{description}</div>}
      {onAction && actionLabel && (
        <button
          type="button"
          className="app-button ghost"
          style={{ width: "fit-content", padding: "6px 12px", fontSize: 13 }}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
