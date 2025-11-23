import React, { useEffect, useMemo, useState } from "react";
import {
  fetchRegulatorAlerts,
  fetchRegulatorBankSummary,
  fetchRegulatorComplianceReport,
  fetchRegulatorMonitoringSnapshots,
} from "./api";
import { getRegulatorSession, getRegulatorToken } from "./regulatorAuth";

type ComplianceReport = Awaited<ReturnType<typeof fetchRegulatorComplianceReport>>;
type AlertsResponse = Awaited<ReturnType<typeof fetchRegulatorAlerts>>;
type MonitoringResponse = Awaited<ReturnType<typeof fetchRegulatorMonitoringSnapshots>>;
type BankSummaryResponse = Awaited<ReturnType<typeof fetchRegulatorBankSummary>>;

type State = {
  loading: boolean;
  error: string | null;
  compliance: ComplianceReport | null;
  alerts: AlertsResponse["alerts"] | null;
  snapshots: MonitoringResponse["snapshots"] | null;
  bankSummary: BankSummaryResponse | null;
};

const initialState: State = {
  loading: true,
  error: null,
  compliance: null,
  alerts: null,
  snapshots: null,
  bankSummary: null,
};

export default function RegulatorOverviewPage() {
  const token = getRegulatorToken();
  const session = getRegulatorSession();
  const [state, setState] = useState<State>(initialState);

  useEffect(() => {
    if (!token) {
      setState((prev) => ({ ...prev, loading: false, error: "Session expired" }));
      return;
    }
    const authToken = token;
    let cancelled = false;
    async function load() {
      setState(initialState);
      try {
        const [compliance, alerts, snapshots, bankSummary] = await Promise.all([
          fetchRegulatorComplianceReport(authToken),
          fetchRegulatorAlerts(authToken),
          fetchRegulatorMonitoringSnapshots(authToken, 5),
          fetchRegulatorBankSummary(authToken),
        ]);
        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          compliance,
          alerts: alerts.alerts,
          snapshots: snapshots.snapshots,
          bankSummary,
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "load_failed";
        setState({
          loading: false,
          error: message,
          compliance: null,
          alerts: null,
          snapshots: null,
          bankSummary: null,
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const latestSnapshot = useMemo(() => state.snapshots?.[0] ?? null, [state.snapshots]);

  if (!token) {
    return (
      <div style={panelStyle}>
        <h2 style={panelTitleStyle}>Session expired</h2>
        <p>Please sign in again to continue.</p>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div style={panelStyle}>
        <h2 style={panelTitleStyle}>Loading regulator view...</h2>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={panelStyle}>
        <h2 style={panelTitleStyle}>Unable to load regulator overview</h2>
        <p style={{ color: "#b91c1c" }}>{state.error}</p>
      </div>
    );
  }

  const compliance = state.compliance!;
  const alerts = state.alerts ?? [];
  const bankSummary = state.bankSummary;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header style={headerStyle}>
        <div>
          <h1 style={headerTitleStyle}>Regulator snapshot</h1>
          <p style={headerSubtitleStyle}>
            Live evidence pack for <strong>{session?.orgId ?? compliance.orgId}</strong>
          </p>
        </div>
        <div style={pillGroupStyle}>
          <StatusPill
            label="Next BAS due"
            value={compliance.nextBasDue ? formatDate(compliance.nextBasDue) : "Not scheduled"}
          />
          <StatusPill
            label="High severity alerts"
            value={String(compliance.alertsSummary.openHighSeverity)}
            tone={compliance.alertsSummary.openHighSeverity > 0 ? "warn" : "ok"}
          />
          <StatusPill
            label="Holding PAYGW"
            value={formatCurrency(compliance.designatedTotals.paygw)}
          />
          <StatusPill
            label="Holding GST"
            value={formatCurrency(compliance.designatedTotals.gst)}
          />
        </div>
      </header>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Compliance timeline</h2>
        <div style={{ display: "grid", gap: "12px" }}>
          {compliance.basHistory.length === 0 ? (
            <div style={emptyStateStyle}>No BAS history found.</div>
          ) : (
            compliance.basHistory.map((entry) => (
              <div key={entry.period} style={timelineRowStyle}>
                <div>
                  <div style={timelinePeriodStyle}>{entry.period}</div>
                  <div style={timelineMetaStyle}>
                    Lodged: {entry.lodgedAt ? formatDate(entry.lodgedAt) : "Pending"}
                  </div>
                </div>
                <div style={timelineStatusStyle(entry.status)}>
                  {entry.status}
                  <span style={timelineNotesStyle}>{entry.notes}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Alerts overview</h2>
        {alerts.length === 0 ? (
          <div style={emptyStateStyle}>No open alerts.</div>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {alerts.slice(0, 6).map((alert) => (
              <div key={alert.id} style={alertRowStyle(alert.severity)}>
                <div>
                  <div style={alertTypeStyle}>{alert.type}</div>
                  <div style={alertMessageStyle}>{alert.message}</div>
                </div>
                <div style={alertMetaStyle}>
                  <span>{formatDate(alert.createdAt)}</span>
                  <span>{alert.resolved ? "Resolved" : "Open"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Designated accounts snapshot</h2>
        {latestSnapshot?.payload ? (
          <div style={snapshotGridStyle}>
            <SnapshotCard
              title="PAYGW holding status"
              payload={latestSnapshot.payload}
              field="paygw"
            />
            <SnapshotCard
              title="GST holding status"
              payload={latestSnapshot.payload}
              field="gst"
            />
            <div style={snapshotCardStyle}>
              <div style={snapshotTitleStyle}>Blockers</div>
              {latestSnapshot.payload.bas?.blockers?.length ? (
                <ul style={blockersListStyle}>
                  {latestSnapshot.payload.bas.blockers.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div style={emptyStateStyle}>No blockers recorded.</div>
              )}
            </div>
          </div>
        ) : (
          <div style={emptyStateStyle}>No monitoring snapshot captured yet.</div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Bank activity summary</h2>
        {bankSummary ? (
          <div style={bankSummaryLayoutStyle}>
            <div>
              <div style={bankSummaryLabelStyle}>Total ledger entries</div>
              <div style={bankSummaryValueStyle}>{bankSummary.summary.totalEntries}</div>
            </div>
            <div>
              <div style={bankSummaryLabelStyle}>Total secured amount</div>
              <div style={bankSummaryValueStyle}>
                {formatCurrency(bankSummary.summary.totalAmount)}
              </div>
            </div>
            <div>
              <div style={bankSummaryLabelStyle}>Window</div>
              <div style={bankSummaryValueStyle}>
                {bankSummary.summary.firstEntryAt
                  ? `${formatDate(bankSummary.summary.firstEntryAt)} → ${formatDate(
                      bankSummary.summary.lastEntryAt ?? bankSummary.summary.firstEntryAt
                    )}`
                  : "No data"}
              </div>
            </div>
          </div>
        ) : (
          <div style={emptyStateStyle}>Unable to load bank summary.</div>
        )}
      </section>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type StatusTone = "ok" | "warn";

function StatusPill({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: StatusTone;
}) {
  const colors =
    tone === "ok"
      ? { bg: "rgba(34, 197, 94, 0.12)", color: "#166534" }
      : { bg: "rgba(239, 68, 68, 0.12)", color: "#b91c1c" };
  return (
    <div
      style={{
        borderRadius: "999px",
        padding: "8px 16px",
        backgroundColor: colors.bg,
        color: colors.color,
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: "140px",
      }}
    >
      <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <strong style={{ fontSize: "16px" }}>{value}</strong>
    </div>
  );
}

function SnapshotCard({
  title,
  payload,
  field,
}: {
  title: string;
  payload: MonitoringResponse["snapshots"][number]["payload"];
  field: "paygw" | "gst";
}) {
  const info = payload.bas?.[field];
  if (!info) {
    return (
      <div style={snapshotCardStyle}>
        <div style={snapshotTitleStyle}>{title}</div>
        <div style={emptyStateStyle}>No BAS context captured.</div>
      </div>
    );
  }
  const statusTone = info.status === "READY" ? "ok" : "warn";
  return (
    <div style={snapshotCardStyle}>
      <div style={snapshotTitleStyle}>{title}</div>
      <div style={snapshotFieldStyle}>
        <span>Status</span>
        <span style={statusBadgeStyle(statusTone)}>{info.status}</span>
      </div>
      <div style={snapshotMetricStyle}>
        <span>Required</span>
        <strong>{formatCurrency(info.required ?? 0)}</strong>
      </div>
      <div style={snapshotMetricStyle}>
        <span>Secured</span>
        <strong>{formatCurrency(info.secured ?? 0)}</strong>
      </div>
    </div>
  );
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

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: "28px",
  margin: 0,
  color: "#0f172a",
};

const headerSubtitleStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "#475569",
  marginTop: "6px",
};

const pillGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  padding: "24px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  display: "grid",
  gap: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  margin: 0,
  color: "#0f172a",
};

const emptyStateStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "8px",
  background: "#f1f5f9",
  color: "#475569",
  fontSize: "14px",
};

const timelineRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};

const timelinePeriodStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#0f172a",
};

const timelineMetaStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
};

const timelineStatusStyle = (status: string): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: status === "ON_TIME" ? "#15803d" : "#b45309",
});

const timelineNotesStyle: React.CSSProperties = {
  fontWeight: 400,
  color: "#475569",
  fontSize: "12px",
};

const alertRowStyle = (severity: string): React.CSSProperties => {
  const tones: Record<string, { border: string; bg: string }> = {
    HIGH: { border: "#fca5a5", bg: "rgba(239, 68, 68, 0.08)" },
    MEDIUM: { border: "#fcd34d", bg: "rgba(250, 204, 21, 0.08)" },
    default: { border: "#bae6fd", bg: "rgba(59, 130, 246, 0.08)" },
  };
  const tone = tones[severity] ?? tones.default;
  return {
    borderLeft: `4px solid ${tone.border}`,
    background: tone.bg,
    padding: "12px 16px",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  };
};

const alertTypeStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "14px",
  color: "#0f172a",
};

const alertMessageStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#334155",
  marginTop: "4px",
};

const alertMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#475569",
  display: "grid",
  justifyItems: "end",
  gap: "4px",
};

const snapshotGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const snapshotCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "16px",
  display: "grid",
  gap: "12px",
};

const snapshotTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#0f172a",
};

const snapshotFieldStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: "13px",
  color: "#475569",
};

const statusBadgeStyle = (tone: "ok" | "warn"): React.CSSProperties => ({
  padding: "4px 8px",
  borderRadius: "999px",
  background: tone === "ok" ? "rgba(16, 185, 129, 0.12)" : "rgba(234, 179, 8, 0.14)",
  color: tone === "ok" ? "#047857" : "#92400e",
  fontWeight: 600,
  fontSize: "12px",
});

const snapshotMetricStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "13px",
  color: "#475569",
};

const blockersListStyle: React.CSSProperties = {
  margin: 0,
  paddingInlineStart: "16px",
  display: "grid",
  gap: "8px",
  color: "#334155",
  fontSize: "13px",
};

const bankSummaryLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "24px",
};

const bankSummaryLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
  marginBottom: "8px",
};

const bankSummaryValueStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "#0f172a",
};
