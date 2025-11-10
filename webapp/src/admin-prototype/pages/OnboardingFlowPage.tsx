import React, { useMemo } from "react";

const mockApplications = [
  {
    id: "org_sydney_001",
    legalName: "Sydney Freight Holdings",
    abn: "12 345 678 901",
    payrollProvider: "Employment Hero",
    lastPayRun: "2025-02-14",
    captureStatus: "Funds secured",
  },
  {
    id: "org_melbourne_204",
    legalName: "Melbourne Creative Studio",
    abn: "98 765 432 109",
    payrollProvider: "KeyPay",
    lastPayRun: "2025-02-12",
    captureStatus: "Pending sweep",
  },
];

const onboardingSteps = [
  {
    title: "1. Intake & entity verification",
    detail:
      "We ingest the application payload (ABN, director IDs, trust deed) and resolve it against the Australian Business Register.",
  },
  {
    title: "2. Bank mandate",
    detail:
      "The customer authorises APGMS to hold PAYGW/GST in segregated accounts. Mandate approval triggers a capture rule in the ledger service.",
  },
  {
    title: "3. Payroll feed activation",
    detail:
      "We fetch the latest payroll run to pre-calculate the withholding amount and create a sweep to the protected account.",
  },
];

export default function OnboardingFlowPage() {
  const gridRows = useMemo(() => mockApplications, []);

  return (
    <div style={{ display: "grid", gap: "32px" }}>
      <header style={headerStyle}>
        <div>
          <h2 style={pageTitleStyle}>Customer onboarding walkthrough</h2>
          <p style={pageSubtitleStyle}>
            Demo the compliance controls that run before a business can lodge BAS via
            APGMS. All records below are mock identifiers wired into the dev API so we
            can talk through the real payloads.
          </p>
        </div>
        <span style={badgeStyle}>Mock data</span>
      </header>

      <section style={stepsGridStyle}>
        {onboardingSteps.map((step) => (
          <div key={step.title} style={stepCardStyle}>
            <h3 style={stepTitleStyle}>{step.title}</h3>
            <p style={stepDetailStyle}>{step.detail}</p>
          </div>
        ))}
      </section>

      <section style={tableWrapperStyle}>
        <h3 style={tableTitleStyle}>Applications staged for demo</h3>
        <div style={tableStyle}>
          <div style={{ ...tableRowStyle, fontWeight: 600, color: "#1f2937" }}>
            <span>Org ID</span>
            <span>Legal name</span>
            <span>ABN</span>
            <span>Payroll provider</span>
            <span>Last pay run</span>
            <span>Capture status</span>
          </div>
          {gridRows.map((row) => (
            <div key={row.id} style={tableRowStyle}>
              <span style={monoStyle}>{row.id}</span>
              <span>{row.legalName}</span>
              <span style={monoStyle}>{row.abn}</span>
              <span>{row.payrollProvider}</span>
              <span>{row.lastPayRun}</span>
              <span style={{ fontWeight: 600 }}>{row.captureStatus}</span>
            </div>
          ))}
        </div>
        <p style={tableFooterStyle}>
          Use these identifiers to jump into the ledger service when regulators ask how we
          ringfence PAYGW before BAS submission.
        </p>
      </section>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  backgroundColor: "#ffffff",
  padding: "24px 28px",
  borderRadius: "16px",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.07)",
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "22px",
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "15px",
  color: "#4b5563",
  lineHeight: 1.5,
};

const badgeStyle: React.CSSProperties = {
  alignSelf: "center",
  backgroundColor: "#0b5fff",
  color: "white",
  fontSize: "12px",
  fontWeight: 600,
  padding: "6px 12px",
  borderRadius: "999px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const stepsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const stepCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "20px",
  borderRadius: "14px",
  boxShadow: "0 16px 32px rgba(15, 23, 42, 0.05)",
  display: "grid",
  gap: "8px",
};

const stepTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
};

const stepDetailStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  color: "#4b5563",
  lineHeight: 1.45,
};

const tableWrapperStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "16px",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: "16px",
};

const tableTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
};

const tableStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: "12px",
  alignItems: "center",
  fontSize: "14px",
  color: "#1f2937",
  padding: "12px 16px",
  borderRadius: "12px",
  backgroundColor: "#f8fafc",
};

const monoStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', SFMono-Regular, ui-monospace, monospace",
  fontSize: "13px",
};

const tableFooterStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "#475569",
};
