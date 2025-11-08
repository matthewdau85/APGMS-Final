import React, { useEffect, useMemo, useState } from "react";
import {
  fetchRegulatorAlerts,
  fetchRegulatorBankSummary,
  fetchRegulatorComplianceReport,
  fetchRegulatorMonitoringSnapshots,
  fetchRegulatorBasDiscrepancyReport,
  type BasDiscrepancyReport,
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
  discrepancyReport: BasDiscrepancyReport | null;
};

const initialState: State = {
  loading: true,
  error: null,
  compliance: null,
  alerts: null,
  snapshots: null,
  bankSummary: null,
  discrepancyReport: null,
};

export default function RegulatorOverviewPage() {
  const token = getRegulatorToken();
  const session = getRegulatorSession();
  const [state, setState] = useState<State>(initialState);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState((prev) => ({ ...prev, loading: false, error: "Session expired" }));
      return;
    }
    let cancelled = false;
    async function load() {
      setState(initialState);
      try {
        const [compliance, alerts, snapshots, bankSummary, discrepancy] = await Promise.all([
          fetchRegulatorComplianceReport(token),
          fetchRegulatorAlerts(token),
          fetchRegulatorMonitoringSnapshots(token, 5),
          fetchRegulatorBankSummary(token),
          fetchRegulatorBasDiscrepancyReport(token),
        ]);
        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          compliance,
          alerts: alerts.alerts,
          snapshots: snapshots.snapshots,
          bankSummary,
          discrepancyReport: discrepancy.report,
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
          discrepancyReport: null,
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const latestSnapshot = useMemo(() => state.snapshots?.[0] ?? null, [state.snapshots]);
  const discrepancy = state.discrepancyReport;
  const hasDiscrepancies = Boolean(discrepancy && discrepancy.discrepancies.length > 0);
  const reportId = discrepancy?.id ?? null;

  useEffect(() => {
    setReportError(null);
  }, [reportId]);

  const handleDownloadReport = (format: "pdf" | "json") => {
    setReportError(null);
    if (!discrepancy) {
      setReportError("Discrepancy report is not available yet.");
      return;
    }
    if (format === "pdf") {
      if (!discrepancy.pdfBase64) {
        setReportError("PDF artifact missing from latest report.");
        return;
      }
      downloadBase64File(
        `bas-discrepancy-${discrepancy.generatedAt}.pdf`,
        discrepancy.pdfBase64,
        "application/pdf",
      );
      return;
    }

    const jsonString = JSON.stringify(discrepancy.json ?? discrepancy, null, 2);
    downloadTextFile(
      `bas-discrepancy-${discrepancy.generatedAt}.json`,
      jsonString,
      "application/json",
    );
  };

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
        <div style={sectionHeaderRowStyle}>
          <div>
            <h2 style={sectionTitleStyle}>BAS discrepancy report</h2>
            <p style={sectionSubtitleStyle}>
              Latest verifier output comparing designated balances with expected PAYGW/GST.
            </p>
          </div>
          {discrepancy ? (
            <div style={discrepancyMetaStyle}>
              <span>Generated {formatDate(discrepancy.generatedAt)}</span>
              <span>
                SHA-256 <code style={monoHashStyle}>{discrepancy.sha256}</code>
              </span>
            </div>
          ) : null}
        </div>
        {reportError ? <div style={errorBannerStyle}>{reportError}</div> : null}
        {discrepancy ? (
          <div style={discrepancyGridStyle}>
            <div style={discrepancySummaryColumnStyle}>
              <div style={discrepancySummaryCardStyle}>
                <div>
                  <div style={discrepancySummaryLabelStyle}>BAS cycle</div>
                  <div style={discrepancySummaryValueStyle}>
                    {discrepancy.basCycle
                      ? formatDateRange(
                          discrepancy.basCycle.periodStart,
                          discrepancy.basCycle.periodEnd,
                        )
                      : "No BAS cycle linked"}
                  </div>
                </div>
                <div style={discrepancyAmountsGridStyle}>
                  <div style={discrepancyAmountCardStyle}>
                    <span style={discrepancySummaryLabelStyle}>Expected PAYGW</span>
                    <strong style={discrepancySummaryValueStyle}>
                      {discrepancy.expected
                        ? formatCurrency(discrepancy.expected.paygw)
                        : "—"}
                    </strong>
                  </div>
                  <div style={discrepancyAmountCardStyle}>
                    <span style={discrepancySummaryLabelStyle}>Designated PAYGW</span>
                    <strong style={discrepancySummaryValueStyle}>
                      {discrepancy.designated
                        ? formatCurrency(discrepancy.designated.paygw)
                        : "—"}
                    </strong>
                  </div>
                  <div style={discrepancyAmountCardStyle}>
                    <span style={discrepancySummaryLabelStyle}>Expected GST</span>
                    <strong style={discrepancySummaryValueStyle}>
                      {discrepancy.expected
                        ? formatCurrency(discrepancy.expected.gst)
                        : "—"}
                    </strong>
                  </div>
                  <div style={discrepancyAmountCardStyle}>
                    <span style={discrepancySummaryLabelStyle}>Designated GST</span>
                    <strong style={discrepancySummaryValueStyle}>
                      {discrepancy.designated
                        ? formatCurrency(discrepancy.designated.gst)
                        : "—"}
                    </strong>
                  </div>
                </div>
                <div style={discrepancyStatusBadge(hasDiscrepancies)}>
                  {hasDiscrepancies ? "Remittance blocked" : "No discrepancies detected"}
                </div>
              </div>
              <div style={discrepancyActionsStyle}>
                <button type="button" style={downloadButtonStyle} onClick={() => handleDownloadReport("pdf")}>
                  Download PDF report
                </button>
                <button
                  type="button"
                  style={secondaryDownloadButtonStyle}
                  onClick={() => handleDownloadReport("json")}
                >
                  Download JSON evidence
                </button>
              </div>
            </div>
            <div style={discrepancyDetailColumnStyle}>
              <div style={discrepancyDetailCardStyle}>
                <div style={discrepancyDetailHeaderStyle}>Discrepancies</div>
                {discrepancy.discrepancies.length === 0 ? (
                  <div style={emptyStateStyle}>No variance captured in latest cycle.</div>
                ) : (
                  <div style={discrepancyListStyle}>
                    {discrepancy.discrepancies.map((item, idx) => (
                      <div key={`${item.tax}-${idx}`} style={discrepancyListItemStyle}>
                        <div style={discrepancyItemHeaderStyle}>
                          <span style={discrepancyTagStyle}>{item.tax}</span>
                          <span style={discrepancyDeltaStyle(item.delta)}>
                            {item.delta >= 0 ? "Shortfall" : "Surplus"} {formatCurrency(Math.abs(item.delta))}
                          </span>
                        </div>
                        <div style={discrepancyItemMetricsStyle}>
                          <span>Expected {formatCurrency(item.expected)}</span>
                          <span>Designated {formatCurrency(item.designated)}</span>
                        </div>
                        <p style={discrepancyGuidanceStyle}>{item.guidance}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={discrepancyDetailCardStyle}>
                <div style={discrepancyDetailHeaderStyle}>Remediation steps</div>
                {discrepancy.remediation.length === 0 ? (
                  <div style={emptyStateStyle}>No remediation guidance recorded.</div>
                ) : (
                  <ul style={remediationListStyle}>
                    {discrepancy.remediation.map((step, idx) => (
                      <li key={idx} style={remediationItemStyle}>
                        {step}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={emptyStateStyle}>
            Verification aligned with designated balances; no discrepancy report has been issued yet.
          </div>
        )}
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

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString("en-AU", opts)} → ${endDate.toLocaleDateString("en-AU", opts)}`;
  }
  if (start) {
    return new Date(start).toLocaleDateString("en-AU", opts);
  }
  return new Date(end!).toLocaleDateString("en-AU", opts);
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

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#475569",
  margin: "6px 0 0",
  maxWidth: "520px",
};

const sectionHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const emptyStateStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "8px",
  background: "#f1f5f9",
  color: "#475569",
  fontSize: "14px",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "8px",
  background: "rgba(239, 68, 68, 0.12)",
  color: "#b91c1c",
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

const discrepancyMetaStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  fontSize: "13px",
  color: "#475569",
  justifyItems: "end",
};

const monoHashStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', 'SFMono-Regular', 'Menlo', monospace",
  fontSize: "12px",
  background: "#f8fafc",
  padding: "2px 6px",
  borderRadius: "4px",
};

const discrepancyGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const discrepancySummaryColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
};

const discrepancyDetailColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
};

const discrepancySummaryCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "18px",
  display: "grid",
  gap: "16px",
  background: "#f8fafc",
};

const discrepancySummaryLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
};

const discrepancySummaryValueStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#0f172a",
};

const discrepancyAmountsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const discrepancyAmountCardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  padding: "12px",
  display: "grid",
  gap: "8px",
};

const discrepancyStatusBadge = (active: boolean): React.CSSProperties => ({
  alignSelf: "flex-start",
  padding: "6px 12px",
  borderRadius: "999px",
  background: active ? "rgba(234, 179, 8, 0.14)" : "rgba(16, 185, 129, 0.12)",
  color: active ? "#92400e" : "#047857",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
});

const discrepancyActionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
};

const downloadButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  backgroundColor: "#1d4ed8",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryDownloadButtonStyle: React.CSSProperties = {
  ...downloadButtonStyle,
  backgroundColor: "#e0f2fe",
  color: "#1d4ed8",
};

const discrepancyDetailCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "18px",
  display: "grid",
  gap: "12px",
};

const discrepancyDetailHeaderStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#0f172a",
};

const discrepancyListStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const discrepancyListItemStyle: React.CSSProperties = {
  border: "1px solid #cbd5f5",
  borderRadius: "10px",
  padding: "12px",
  background: "#ffffff",
  display: "grid",
  gap: "8px",
};

const discrepancyItemHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const discrepancyTagStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#1e3a8a",
  letterSpacing: "0.08em",
};

const discrepancyDeltaStyle = (delta: number): React.CSSProperties => ({
  fontSize: "13px",
  fontWeight: 600,
  color: delta >= 0 ? "#b91c1c" : "#047857",
});

const discrepancyItemMetricsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  fontSize: "13px",
  color: "#475569",
};

const discrepancyGuidanceStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "#334155",
  lineHeight: 1.5,
};

const remediationListStyle: React.CSSProperties = {
  margin: 0,
  paddingInlineStart: "18px",
  display: "grid",
  gap: "8px",
  color: "#334155",
  fontSize: "13px",
};

const remediationItemStyle: React.CSSProperties = {
  lineHeight: 1.5,
};

function downloadBase64File(filename: string, base64: string, mimeType: string) {
  const link = document.createElement("a");
  link.href = `data:${mimeType};base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
