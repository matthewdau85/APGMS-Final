import React from "react";
import { getSessionUser } from "../../auth";

export default function OverviewPage() {
  const user = getSessionUser();

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section style={introCardStyle}>
        <div>
          <h2 style={sectionTitleStyle}>Why this prototype exists</h2>
          <p style={bodyTextStyle}>
            The regulator walkthrough condenses the core APGMS workflows — onboarding,
            ledger capture, and risk review — into a guided script. It is powered by the
            same API services that back the production console, but swaps in synthetic
            organisation identifiers so we can demo end-to-end without touching live
            taxpayer records.
          </p>
        </div>
        <ul style={bulletListStyle}>
          <li>
            <strong>Admin only:</strong> requires an admin role and the
            <code style={codeStyle}> VITE_ENABLE_ADMIN_PROTOTYPE </code> flag.
          </li>
          <li>
            <strong>Read-only:</strong> write operations are mocked and never call the
            production ledger.
          </li>
          <li>
            <strong>Scripted checkpoints:</strong> each page highlights the evidence we
            surface when demonstrating controls to the ATO.
          </li>
        </ul>
      </section>

      <section style={twoColumnStyle}>
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Suggested flow</h3>
          <ol style={orderedListStyle}>
            <li>Start with the onboarding walkthrough to show KYC & banking controls.</li>
            <li>
              Jump to the risk review to map our live alerts directly to regulator
              questions.
            </li>
            <li>
              Close by returning to the production dashboard to show parity between the
              prototype and the deployed surface.
            </li>
          </ol>
        </div>
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Session context</h3>
          <dl style={definitionListStyle}>
            <div>
              <dt>Environment flag</dt>
              <dd>{import.meta.env.VITE_ENABLE_ADMIN_PROTOTYPE ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Signed in user</dt>
              <dd>{user?.id ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.role ?? "Unknown"}</dd>
            </div>
          </dl>
          <p style={bodyTextStyle}>
            Toggle the feature flag per environment so that the prototype is only visible
            in regulated dry-run sessions.
          </p>
        </div>
      </section>
    </div>
  );
}

const introCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "32px",
  borderRadius: "16px",
  boxShadow: "0px 30px 60px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "24px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "24px",
  margin: 0,
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "#1f2937",
  lineHeight: 1.5,
};

const bulletListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "20px",
  display: "grid",
  gap: "8px",
  fontSize: "14px",
  color: "#374151",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "monospace",
  backgroundColor: "#e2e8f0",
  padding: "2px 6px",
  borderRadius: "6px",
  fontSize: "12px",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: "24px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "16px",
  boxShadow: "0px 20px 40px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: "16px",
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
};

const orderedListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "20px",
  display: "grid",
  gap: "8px",
  fontSize: "14px",
  color: "#1f2937",
};

const definitionListStyle: React.CSSProperties = {
  margin: 0,
  display: "grid",
  gap: "12px",
  fontSize: "14px",
  color: "#1f2937",
};
