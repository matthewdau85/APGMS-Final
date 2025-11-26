import React, { useEffect, useState } from "react";
import { fetchGstFeeds, fetchPayrollFeeds, generateDemoBankLines } from "./api";
import { getToken } from "./auth";
import { EmptyState, ErrorState, SkeletonBlock, StatusChip } from "./components/UI";

type PayrollRun = Awaited<ReturnType<typeof fetchPayrollFeeds>>["runs"][number];
type GstDay = Awaited<ReturnType<typeof fetchGstFeeds>>["days"][number];

export default function FeedsPage() {
  const token = getToken();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [gstDays, setGstDays] = useState<GstDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void loadFeeds();
  }, [token]);

  async function loadFeeds() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [payroll, gst] = await Promise.all([
        fetchPayrollFeeds(token),
        fetchGstFeeds(token),
      ]);
      setPayrollRuns(payroll.runs);
      setGstDays(gst.days);
      setSuccess(null);
    } catch (err) {
      console.error(err);
      setError("Unable to load feeds");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoIngest() {
    if (!token) return;
    setDemoBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await generateDemoBankLines(token, { daysBack: 5, intensity: "low" });
      setSuccess("Demo feed ingested. Refreshing feeds...");
      await loadFeeds();
    } catch (err) {
      console.error(err);
      setError("Unable to ingest demo feed");
    } finally {
      setDemoBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={pageTitleStyle}>Payroll & GST Feeds</h1>
          <p style={pageSubtitleStyle}>
            Live data feeds that feed the compliance engine. We surface payroll runs and daily GST summaries to monitor capture.
          </p>
        </div>
        <button type="button" className="app-button" onClick={() => void handleDemoIngest()} disabled={demoBusy}>
          {demoBusy ? "Ingesting demo feed..." : "Reingest demo feed"}
        </button>
      </header>

      {loading && (
        <div style={{ display: "grid", gap: 8 }}>
          <SkeletonBlock width="50%" />
          <SkeletonBlock width="100%" height={120} />
          <SkeletonBlock width="100%" height={120} />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={loadFeeds} detail="We could not load feed ingests." />}
      {success && <div style={successTextStyle}>{success}</div>}

      {!loading && !error && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Payroll Runs</h2>
            {payrollRuns.length === 0 ? (
              <EmptyState
                title="No payroll ingests yet"
                description="Replay the demo feed to populate PAYGW capture and see ledger evidence populate in real time."
                actionLabel={demoBusy ? "Reingesting..." : "Reingest demo feed"}
                onAction={demoBusy ? undefined : () => void handleDemoIngest()}
              />
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Run ID</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Gross Wages</th>
                    <th style={thStyle}>PAYGW Calculated</th>
                    <th style={thStyle}>PAYGW Secured</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRuns.map((run) => (
                    <tr key={run.id}>
                      <td style={tdStyle}>{run.id}</td>
                      <td style={tdStyle}>{run.date}</td>
                      <td style={tdStyle}>{formatCurrency(run.grossWages)}</td>
                      <td style={tdStyle}>{formatCurrency(run.paygwCalculated)}</td>
                      <td style={tdStyle}>{formatCurrency(run.paygwSecured)}</td>
                      <td style={tdStyle}>
                        <StatusChip tone={statusTone(run.status)}>{run.status}</StatusChip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>GST Daily Summary</h2>
            {gstDays.length === 0 ? (
              <EmptyState
                title="GST feed is empty"
                description="Push the demo feed to see daily GST capture, variances, and BAS readiness tracked automatically."
                actionLabel={demoBusy ? "Reingesting..." : "Reingest demo feed"}
                onAction={demoBusy ? undefined : () => void handleDemoIngest()}
              />
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Sales Total</th>
                    <th style={thStyle}>GST Calculated</th>
                    <th style={thStyle}>GST Secured</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gstDays.map((day) => (
                    <tr key={day.date}>
                      <td style={tdStyle}>{day.date}</td>
                      <td style={tdStyle}>{formatCurrency(day.salesTotal)}</td>
                      <td style={tdStyle}>{formatCurrency(day.gstCalculated)}</td>
                      <td style={tdStyle}>{formatCurrency(day.gstSecured)}</td>
                      <td style={tdStyle}>
                        <StatusChip tone={statusTone(day.status)}>{day.status}</StatusChip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function statusTone(status: string) {
  const upper = status.toUpperCase();
  if (upper === "READY" || upper === "OK") return "success";
  if (upper === "PARTIAL") return "warning";
  if (upper === "SHORT" || upper === "SHORTFALL") return "danger";
  return "neutral";
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  marginBottom: "8px",
};

const pageSubtitleStyle: React.CSSProperties = {
  color: "#4b5563",
  margin: 0,
  fontSize: "14px",
  maxWidth: "620px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "24px",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6b7280",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "14px",
  borderBottom: "1px solid #f1f5f9",
  color: "#111827",
};

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
};
