import React, { useEffect, useMemo, useState } from "react";
import { fetchRegulatorMonitoringSnapshots } from "./api";
import { getRegulatorToken } from "./regulatorAuth";

type SnapshotResponse = Awaited<ReturnType<typeof fetchRegulatorMonitoringSnapshots>>;
type Snapshot = SnapshotResponse["snapshots"][number];

type State = {
  loading: boolean;
  error: string | null;
  snapshots: Snapshot[];
};

const initialState: State = {
  loading: true,
  error: null,
  snapshots: [],
};

export default function RegulatorMonitoringPage() {
  const token = getRegulatorToken();
  const [state, setState] = useState<State>(initialState);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ loading: false, error: "Session expired", snapshots: [] });
      return;
    }
    let cancelled = false;
    async function load() {
      setState(initialState);
      try {
        const data = await fetchRegulatorMonitoringSnapshots(token, 10);
        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          snapshots: data.snapshots,
        });
        setSelectedId(data.snapshots[0]?.id ?? null);
      } catch (error) {
        if (cancelled) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "load_failed",
          snapshots: [],
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedSnapshot = useMemo(
    () => state.snapshots.find((snap) => snap.id === selectedId) ?? null,
    [state.snapshots, selectedId]
  );

  if (!token) {
    return (
      <div style={panelStyle}>
        <h2 style={panelTitleStyle}>Session expired</h2>
        <p>Please sign in again.</p>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div style={panelStyle}>
        <h2 style={panelTitleStyle}>Loading monitoring timeline...</h2>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={panelStyle}>
        <h2 style={panelTitleStyle}>Unable to load monitoring snapshots</h2>
        <p style={{ color: "#b91c1c" }}>{state.error}</p>
      </div>
    );
  }

  return (
    <div style={layoutStyle}>
      <aside style={listStyle}>
        <h2 style={listTitleStyle}>Monitoring cadence</h2>
        <p style={listSubtitleStyle}>
          Automated snapshots when alerts update, obligations change, or plans are requested.
        </p>
        <div style={listItemsStyle}>
          {state.snapshots.length === 0 ? (
            <div style={emptyStateStyle}>No monitoring events captured.</div>
          ) : (
            state.snapshots.map((snapshot) => (
              <button
                key={snapshot.id}
                type="button"
                onClick={() => setSelectedId(snapshot.id)}
                style={{
                  ...listItemButtonStyle,
                  borderColor: snapshot.id === selectedId ? "#0b5fff" : "transparent",
                  background:
                    snapshot.id === selectedId ? "rgba(11, 95, 255, 0.12)" : "transparent",
                }}
              >
                <div style={listItemTitleStyle}>
                  {formatDate(snapshot.createdAt)}
                </div>
                <div style={listItemMetaStyle}>
                  Alerts: {snapshot.payload.alerts.total} · Plans open:{" "}
                  {snapshot.payload.paymentPlansOpen}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
      <section style={detailStyle}>
        {selectedSnapshot ? (
          <SnapshotDetail snapshot={selectedSnapshot} />
        ) : (
          <div style={emptyStateStyle}>Select a snapshot to inspect metrics.</div>
        )}
      </section>
    </div>
  );
}

function SnapshotDetail({ snapshot }: { snapshot: Snapshot }) {
  const payload = snapshot.payload;
  const concentration = payload.detectorConcentration ?? null;
  return (
    <div style={detailContentStyle}>
      <header style={detailHeaderStyle}>
        <div>
          <div style={detailTitleStyle}>
            Snapshot generated {formatDate(snapshot.createdAt)}
          </div>
          <div style={detailSubtitleStyle}>
            Evidence captured at {formatDate(payload.generatedAt)}
          </div>
        </div>
        <div style={tagGroupStyle}>
          <DetailTag label="Alerts" value={String(payload.alerts.total)} />
          <DetailTag label="High severity" value={String(payload.alerts.openHigh)} tone="warn" />
          <DetailTag label="Payment plans open" value={String(payload.paymentPlansOpen)} />
        </div>
      </header>

      <div style={detailGridStyle}>
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Bas readiness</h3>
          {payload.bas ? (
            <div style={cardBodyStyle}>
              <ReadinessRow label="Overall" status={payload.bas.overallStatus} />
              <ReadinessRow label="PAYGW" status={payload.bas.paygw.status} />
              <ReadinessRow label="GST" status={payload.bas.gst.status} />
              {payload.bas.blockers.length > 0 ? (
                <ul style={blockerListStyle}>
                  {payload.bas.blockers.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div style={emptyStateStyle}>No blockers recorded.</div>
              )}
            </div>
          ) : (
            <div style={emptyStateStyle}>BAS preview unavailable.</div>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Designated account balances</h3>
          <div style={cardBodyStyle}>
            <MetricRow label="PAYGW" value={formatCurrency(payload.designatedTotals.paygw)} />
            <MetricRow label="GST" value={formatCurrency(payload.designatedTotals.gst)} />
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Recent alert activity</h3>
          {payload.alerts.recent.length === 0 ? (
            <div style={emptyStateStyle}>No recent alerts.</div>
          ) : (
            <div style={recentListStyle}>
              {payload.alerts.recent.map((alert) => (
                <div key={alert.id} style={recentRowStyle(alert.severity)}>
                  <div style={recentTitleStyle}>{alert.type}</div>
                  <div style={recentMetaStyle}>
                    {formatDate(alert.createdAt)} · {alert.resolved ? "Resolved" : "Open"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Detector concentration</h3>
          <DetectorConcentrationCard concentration={concentration} />
        </div>
      </div>

      <div style={payloadWrapperStyle}>
        <div style={payloadHeaderStyle}>
          Raw payload
          <span style={payloadHintStyle}>
            Use for downstream evidence ingestion (JSON schema stable).
          </span>
        </div>
        <pre style={payloadPreStyle}>{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  );
}

type DetectorConcentration = NonNullable<Snapshot["payload"]["detectorConcentration"]>;

function DetectorConcentrationCard({
  concentration,
}: {
  concentration: Snapshot["payload"]["detectorConcentration"] | null;
}) {
  if (!concentration || concentration.totalFlagged === 0) {
    return <div style={emptyStateStyle}>No flagged detector activity in this snapshot.</div>;
  }

  const headlineVendor = concentration.vendorShare[0] ?? null;
  const headlineApprover = concentration.approverShare[0] ?? null;

  return (
    <div style={cardBodyStyle}>
      <p style={concentrationCopyStyle}>
        {`Detectors highlighted ${concentration.totalFlagged} rows for analyst review. The breakdown below helps ensure approval boundaries stay healthy and vendors aren't dominating remediation cycles.`}
      </p>
      <div style={concentrationChipRowStyle}>
        {headlineVendor ? (
          <ConcentrationChip
            label="Primary vendor exposure"
            entry={headlineVendor}
            total={concentration.totalFlagged}
          />
        ) : null}
        {headlineApprover ? (
          <ConcentrationChip
            label="Primary approver exposure"
            entry={headlineApprover}
            total={concentration.totalFlagged}
          />
        ) : null}
      </div>
      <div style={concentrationTableGridStyle}>
        <ConcentrationTable title="Vendors" rows={concentration.vendorShare} />
        <ConcentrationTable title="Approvers" rows={concentration.approverShare} />
      </div>
    </div>
  );
}

function ConcentrationChip({
  label,
  entry,
  total,
}: {
  label: string;
  entry: DetectorConcentration["vendorShare"][number];
  total: number;
}) {
  const percentage = formatPercentage(entry.percentage);
  return (
    <div style={concentrationChipStyle}>
      <span style={chipLabelStyle}>{label}</span>
      <strong style={chipValueStyle}>{entry.name}</strong>
      <span style={chipMetaStyle}>
        {entry.count} of {total} flagged rows · {percentage}
      </span>
    </div>
  );
}

function ConcentrationTable({
  title,
  rows,
}: {
  title: string;
  rows: DetectorConcentration["vendorShare"];
}) {
  if (rows.length === 0) {
    return (
      <div style={concentrationTableStyle}>
        <div style={concentrationTableTitleStyle}>{title}</div>
        <div style={emptyStateStyle}>No recurring exposure detected.</div>
      </div>
    );
  }

  return (
    <div style={concentrationTableStyle}>
      <div style={concentrationTableTitleStyle}>{title}</div>
      <table style={concentrationTableElementStyle}>
        <thead>
          <tr>
            <th style={concentrationHeaderCellStyle}>Name</th>
            <th style={concentrationHeaderCellStyle}>Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td style={concentrationCellStyle}>{row.name}</td>
              <td style={concentrationCellStyle}>{formatPercentage(row.percentage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailTag({
  label,
  value,
  tone = "info",
}: {
  label: string;
  value: string;
  tone?: "info" | "warn";
}) {
  const palette =
    tone === "warn"
      ? { bg: "rgba(239, 68, 68, 0.16)", color: "#b91c1c" }
      : { bg: "rgba(59, 130, 246, 0.16)", color: "#1d4ed8" };
  return (
    <div
      style={{
        background: palette.bg,
        color: palette.color,
        borderRadius: "999px",
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 600,
        display: "flex",
        gap: "6px",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ReadinessRow({ label, status }: { label: string; status: string }) {
  const tone = status === "READY" ? "ready" : "blocked";
  const palette =
    tone === "ready"
      ? { color: "#15803d", bg: "rgba(74, 222, 128, 0.16)" }
      : { color: "#c2410c", bg: "rgba(251, 191, 36, 0.18)" };
  return (
    <div style={readinessRowStyle}>
      <span>{label}</span>
      <span style={{ ...readinessBadgeStyle, background: palette.bg, color: palette.color }}>
        {status}
      </span>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  padding: "32px",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 600,
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px 1fr",
  gap: "24px",
};

const listStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  padding: "24px",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.05)",
  display: "grid",
  gap: "16px",
  alignSelf: "start",
};

const listTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 600,
};

const listSubtitleStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
};

const listItemsStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const listItemButtonStyle: React.CSSProperties = {
  textAlign: "left",
  borderRadius: "10px",
  border: "2px solid transparent",
  padding: "12px",
  background: "transparent",
  cursor: "pointer",
  display: "grid",
  gap: "4px",
};

const listItemTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#0f172a",
};

const listItemMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#475569",
};

const emptyStateStyle: React.CSSProperties = {
  background: "#f1f5f9",
  borderRadius: "10px",
  padding: "16px",
  fontSize: "13px",
  color: "#475569",
};

const detailStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  padding: "28px",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.05)",
  minHeight: "520px",
};

const detailContentStyle: React.CSSProperties = {
  display: "grid",
  gap: "24px",
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
};

const detailTitleStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  marginBottom: "4px",
};

const detailSubtitleStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
};

const tagGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap",
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "20px",
};

const concentrationCopyStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#475569",
  lineHeight: 1.5,
  margin: 0,
};

const concentrationChipRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
};

const concentrationChipStyle: React.CSSProperties = {
  background: "rgba(15, 118, 110, 0.12)",
  borderRadius: "12px",
  padding: "12px 16px",
  color: "#0f766e",
  display: "grid",
  gap: "4px",
  minWidth: "180px",
};

const chipLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const chipValueStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
};

const chipMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#0f766e",
};

const concentrationTableGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const concentrationTableStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "12px",
  display: "grid",
  gap: "12px",
};

const concentrationTableTitleStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#0f172a",
};

const concentrationTableElementStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const concentrationHeaderCellStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: "12px",
  color: "#475569",
  paddingBottom: "8px",
  borderBottom: "1px solid #e2e8f0",
};

const concentrationCellStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#0f172a",
  padding: "6px 0",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "18px",
  display: "grid",
  gap: "12px",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  margin: 0,
};

const cardBodyStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const readinessRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "13px",
  color: "#475569",
};

const readinessBadgeStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: "999px",
  fontWeight: 600,
  fontSize: "12px",
};

const metricRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "14px",
  color: "#475569",
};

const blockerListStyle: React.CSSProperties = {
  margin: 0,
  paddingInlineStart: "18px",
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  color: "#334155",
};

const recentListStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const recentRowStyle = (severity: string): React.CSSProperties => {
  const palette: Record<string, { border: string; bg: string }> = {
    HIGH: { border: "#f87171", bg: "rgba(248, 113, 113, 0.16)" },
    MEDIUM: { border: "#fbbf24", bg: "rgba(251, 191, 36, 0.16)" },
    default: { border: "#60a5fa", bg: "rgba(96, 165, 250, 0.16)" },
  };
  const tone = palette[severity] ?? palette.default;
  return {
    borderLeft: `4px solid ${tone.border}`,
    background: tone.bg,
    borderRadius: "10px",
    padding: "12px 16px",
  };
};

const recentTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#0f172a",
};

const recentMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#475569",
  marginTop: "4px",
};

const payloadWrapperStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  overflow: "hidden",
};

const payloadHeaderStyle: React.CSSProperties = {
  padding: "12px 16px",
  background: "#f8fafc",
  fontSize: "13px",
  color: "#475569",
  display: "flex",
  justifyContent: "space-between",
};

const payloadHintStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
};

const payloadPreStyle: React.CSSProperties = {
  margin: 0,
  padding: "18px",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: "12px",
  lineHeight: 1.6,
  maxHeight: "320px",
  overflow: "auto",
  borderRadius: "0 0 12px 12px",
};
