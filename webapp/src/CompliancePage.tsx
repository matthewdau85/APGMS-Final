import React, { useEffect, useState } from "react";
import {
  fetchComplianceReport,
  fetchEvidenceArtifacts,
  createEvidenceArtifact,
  fetchEvidenceArtifactDetail,
} from "./api";
import { getToken } from "./auth";

type ComplianceReport = Awaited<ReturnType<typeof fetchComplianceReport>>;

type PaymentPlan = ComplianceReport["paymentPlans"][number];

type EvidenceArtifactSummary = Awaited<
  ReturnType<typeof fetchEvidenceArtifacts>
>["artifacts"][number];

export default function CompliancePage() {
  const token = getToken();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<EvidenceArtifactSummary[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(true);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [artifactSuccess, setArtifactSuccess] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadReport = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComplianceReport(token);
      setReport(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load compliance report");
    } finally {
      setLoading(false);
    }
  };

  const loadArtifacts = async () => {
    if (!token) return;
    setArtifactLoading(true);
    setArtifactError(null);
    setArtifactSuccess(null);
    try {
      const response = await fetchEvidenceArtifacts(token);
      setArtifacts(response.artifacts);
    } catch (err) {
      console.error(err);
      setArtifactError("Unable to load evidence history");
    } finally {
      setArtifactLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadReport();
    void loadArtifacts();
  }, [token]);

  if (!token) {
    return null;
  }

  function handleDownload() {
    window.open("http://localhost:3000/compliance/report", "_blank");
  }

  async function handleGenerateEvidence() {
    if (!token) return;
    setArtifactError(null);
    setArtifactSuccess(null);
    try {
      const response = await createEvidenceArtifact(token);
      setArtifactSuccess(
        `Evidence pack generated (${response.artifact.id.slice(0, 8)}…, sha ${response.artifact.sha256.slice(0, 12)})`
      );
      await loadArtifacts();
    } catch (err) {
      console.error(err);
      setArtifactError("Unable to generate compliance evidence pack");
    }
  }

  async function handleDownloadArtifact(artifactId: string) {
    if (!token) return;
    setDownloadingId(artifactId);
    try {
      const response = await fetchEvidenceArtifactDetail(token, artifactId);
      const blob = new Blob([JSON.stringify(response.artifact.payload ?? {}, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `apgms-evidence-${artifactId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setArtifactError("Unable to download evidence payload");
    } finally {
      setDownloadingId(null);
    }
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
            <SummaryCard label="Next BAS Due" value={report.nextBasDue ? new Date(report.nextBasDue).toLocaleDateString() : "Not scheduled"} />
            <SummaryCard label="Open High Severity Alerts" value={report.alertsSummary.openHighSeverity.toString()} />
            <SummaryCard label="Resolved This Quarter" value={report.alertsSummary.resolvedThisQuarter.toString()} />
            <SummaryCard label="PAYGW Secured" value={currencyFormatter.format(report.designatedTotals.paygw)} />
            <SummaryCard label="GST Secured" value={currencyFormatter.format(report.designatedTotals.gst)} />
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Payment Plans & Requests</h2>
            {report.paymentPlans.length === 0 ? (
              <div style={infoTextStyle}>No payment plan activity recorded.</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>BAS Cycle</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Weekly Amount</th>
                    <th style={thStyle}>Start Date</th>
                    <th style={thStyle}>Requested</th>
                    <th style={thStyle}>Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td style={tdStyle}>{plan.basCycleId}</td>
                      <td style={tdStyle}>{plan.status}</td>
                      <td style={tdStyle}>{plan.reason}</td>
                      <td style={tdStyle}>{formatWeeklyAmount(plan)}</td>
                      <td style={tdStyle}>{formatPlanStartDate(plan)}</td>
                      <td style={tdStyle}>{new Date(plan.requestedAt).toLocaleString()}</td>
                      <td style={tdStyle}>{plan.resolvedAt ? new Date(plan.resolvedAt).toLocaleString() : "Pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                    <td style={tdStyle}>{entry.lodgedAt ? new Date(entry.lodgedAt).toLocaleString() : "Not lodged"}</td>
                    <td style={tdStyle}>{entry.status}</td>
                    <td style={tdStyle}>{entry.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.basHistory.length === 0 && <div style={infoTextStyle}>No BAS events recorded yet.</div>}
          </section>

          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <h2 style={sectionTitleStyle}>Evidence Pack History</h2>
              <button type="button" style={downloadButtonStyle} onClick={handleGenerateEvidence}>
                Generate new evidence pack
              </button>
            </div>
            {artifactSuccess && <div style={successTextStyle}>{artifactSuccess}</div>}
            {artifactError && <div style={errorTextStyle}>{artifactError}</div>}
            {artifactLoading ? (
              <div style={infoTextStyle}>Loading recorded evidence packs...</div>
            ) : artifacts.length === 0 ? (
              <div style={infoTextStyle}>No evidence packs have been generated yet.</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Artifact ID</th>
                    <th style={thStyle}>Created</th>
                    <th style={thStyle}>SHA-256</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.map((artifact) => (
                    <tr key={artifact.id}>
                      <td style={tdStyle}>
                        <code>{artifact.id}</code>
                      </td>
                      <td style={tdStyle}>{new Date(artifact.createdAt).toLocaleString()}</td>
                      <td style={tdStyle}>
                        <code>{artifact.sha256}</code>
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          style={smallButtonStyle}
                          onClick={() => handleDownloadArtifact(artifact.id)}
                          disabled={downloadingId === artifact.id}
                        >
                          {downloadingId === artifact.id ? "Preparing..." : "Download JSON"}
                        </button>
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

type SummaryCardProps = {
  label: string;
  value: string;
};

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div style={summaryCardStyle}>
      <span style={summaryLabelStyle}>{label}</span>
      <span style={summaryValueStyle}>{value}</span>
    </div>
  );
}

function formatWeeklyAmount(plan: PaymentPlan): string {
  const raw = plan.details["weeklyAmount"];
  if (typeof raw === "number") {
    return currencyFormatter.format(raw);
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return currencyFormatter.format(parsed);
    }
  }
  return "N/A";
}

function formatPlanStartDate(plan: PaymentPlan): string {
  const raw = plan.details["startDate"];
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString();
    }
    return raw;
  }
  return "N/A";
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

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
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

const smallButtonStyle: React.CSSProperties = {
  backgroundColor: "#0b5fff",
  color: "#ffffff",
  border: "none",
  borderRadius: "4px",
  padding: "6px 12px",
  fontSize: "12px",
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
