import React, { useEffect, useState } from "react";
import { fetchGstFeeds, fetchPayrollFeeds } from "./api";
import { getToken } from "./auth";

type PayrollRun = Awaited<ReturnType<typeof fetchPayrollFeeds>>["runs"][number];
type GstDay = Awaited<ReturnType<typeof fetchGstFeeds>>["days"][number];

export default function FeedsPage() {
  const token = getToken();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [gstDays, setGstDays] = useState<GstDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      try {
        const [payroll, gst] = await Promise.all([
          fetchPayrollFeeds(token),
          fetchGstFeeds(token),
        ]);
        setPayrollRuns(payroll.runs);
        setGstDays(gst.days);
      } catch (err) {
        console.error(err);
        setError("Unable to load feeds");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (!token) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header>
        <h1 style={pageTitleStyle}>Payroll & GST Feeds</h1>
        <p style={pageSubtitleStyle}>
          Live data feeds that feed the compliance engine. We surface payroll runs and daily GST summaries to monitor capture.
        </p>
      </header>

      {loading && <div style={infoTextStyle}>Loading feeds...</div>}
      {error && <div style={errorTextStyle}>{error}</div>}

      {!loading && !error && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Payroll Runs</h2>
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
                      <StatusPill status={run.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payrollRuns.length === 0 && (
              <div style={infoTextStyle}>No payroll runs recorded yet.</div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>GST Daily Summary</h2>
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
                      <StatusPill status={day.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {gstDays.length === 0 && (
              <div style={infoTextStyle}>No GST feed data captured yet.</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const palette = statusPalette(status);
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        color: palette.text,
        backgroundColor: palette.background,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
      }}
    >
      {status}
    </span>
  );
}

function statusPalette(status: string) {
  switch (status.toUpperCase()) {
    case "READY":
    case "OK":
      return { background: "rgba(16, 185, 129, 0.12)", text: "#047857" };
    case "PARTIAL":
      return { background: "rgba(250, 204, 21, 0.18)", text: "#92400e" };
    case "SHORT":
    case "SHORTFALL":
      return { background: "rgba(239, 68, 68, 0.12)", text: "#b91c1c" };
    default:
      return { background: "rgba(107, 114, 128, 0.14)", text: "#374151" };
  }
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

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#b91c1c",
};
