import React, { useEffect, useState } from "react";
import { fetchComplianceReport } from "./api";
import { getToken } from "./auth";

type ComplianceReport = Awaited<ReturnType<typeof fetchComplianceReport>>;

export default function CompliancePage() {
  const token = getToken();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      try {
        const data = await fetchComplianceReport(token);
        setReport(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load compliance report");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (!token) {
    return null;
  }

  function handleDownload() {
    window.open("http://localhost:3000/compliance/report", "_blank");
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header>
        <h1 style={pageTitleStyle}>Compliance Evidence</h1>
        <p style={pageSubtitleStyle}>
          Everything the regulator needs in one place: BAS history, outstanding alerts, and the next due lodgment.
        </p>
      </header>

      {loading && <div style={infoTextStyle}>Building compliance view...</div>}
      {error && <div style={errorTextStyle}>{error}</div>}

      {report && !error && (
        <>
          <section style={summaryCardsWrapper}>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Next BAS Due</span>
              <span style={summaryValueStyle}>
                {report.nextBasDue
                  ? new Date(report.nextBasDue).toLocaleDateString()
                  : "Not scheduled"}
              </span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Open High Severity Alerts</span>
              <span style={summaryValueStyle}>{report.alertsSummary.openHighSeverity}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Resolved This Quarter</span>
              <span style={summaryValueStyle}>{report.alertsSummary.resolvedThisQuarter}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>PAYGW Secured</span>
              <span style={summaryValueStyle}>
                {currencyFormatter.format(report.designatedTotals.paygw)}
              </span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>GST Secured</span>
              <span style={summaryValueStyle}>
                {currencyFormatter.format(report.designatedTotals.gst)}
              </span>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <h2 style={sectionTitleStyle}>BAS Lodgment History</h2>
              <button type="button" style={downloadButtonStyle} onClick={handleDownload}>
                Download compliance pack (JSON)
              </button>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Period</th>
                  <th style={thStyle}>Lodged At</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {report.basHistory.map((entry) => (
                  <tr key={entry.period}>
                    <td style={tdStyle}>{entry.period}</td>
                    <td style={tdStyle}>
                      {entry.lodgedAt ? new Date(entry.lodgedAt).toLocaleString() : "Not lodged"}
                    </td>
                    <td style={tdStyle}>{entry.status}</td>
                    <td style={tdStyle}>{entry.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.basHistory.length === 0 && (
              <div style={infoTextStyle}>No BAS events recorded yet.</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const currencyFormatter = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

const pageTitleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  marginBottom: "8px",
};

const pageSubtitleStyle: React.CSSProperties = {
  color: "#4b5563",
  margin: 0,
  fontSize: "14px",
  maxWidth: "600px",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#b91c1c",
};

const summaryCardsWrapper: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const summaryCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "18px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "6px",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#6b7280",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "#111827",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "24px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "16px",
  gap: "12px",
  flexWrap: "wrap",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
};

const downloadButtonStyle: React.CSSProperties = {
  backgroundColor: "#0b5fff",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "10px 16px",
  fontSize: "14px",
  cursor: "pointer",
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
