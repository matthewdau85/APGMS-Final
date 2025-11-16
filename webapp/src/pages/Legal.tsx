import React from "react";
import { Link } from "react-router-dom";

const sectionStyle: React.CSSProperties = {
  padding: "24px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#fff",
  display: "grid",
  gap: "12px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
};

const paragraphStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: 1.6,
  margin: 0,
  color: "#1d2633",
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "18px",
  lineHeight: 1.6,
  color: "#1d2633",
};

function LegalSection({ title, children, id }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} style={sectionStyle}>
      <h2 style={headingStyle}>{title}</h2>
      <div style={{ display: "grid", gap: "8px" }}>{children}</div>
    </section>
  );
}

export default function LegalPage() {
  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "grid",
        gap: "24px",
      }}
    >
      <header style={{ display: "grid", gap: "8px" }}>
        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Updated 1 Nov 2025</p>
        <h1 style={{ fontSize: "28px", margin: 0 }}>Legal, privacy & PayTo consent</h1>
        <p style={{ fontSize: "16px", margin: 0, color: "#1d2633" }}>
          These terms apply to all organisations using the Automated PAYG Management Service (APGMS). Customers acknowledge the
          Terms of Use, Privacy Policy, and Direct Debit Authority during onboarding. You can download a PDF copy from the
          onboarding wizard or contact compliance@apgms.example for alternate formats.
        </p>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <a href="#terms" style={{ color: "#0b5fff", fontWeight: 600 }}>
            Terms of Use
          </a>
          <a href="#privacy" style={{ color: "#0b5fff", fontWeight: 600 }}>
            Privacy Policy
          </a>
          <a href="#direct-debit" style={{ color: "#0b5fff", fontWeight: 600 }}>
            Direct Debit Authority
          </a>
        </div>
      </header>

      <LegalSection id="terms" title="Terms of Use">
        <p style={paragraphStyle}>
          APGMS provides mandate orchestration, BAS forecasting, and PayTo settlement tooling for Australian businesses and
          their advisors. By accepting these terms you confirm that: (1) you have authority to act on behalf of the registered
          entity; (2) information submitted during onboarding (ABN, TFN, banking instructions) is accurate; (3) you will notify
          APGMS of any unauthorised access or suspected breach within 24 hours.
        </p>
        <p style={paragraphStyle}>
          APGMS may suspend access for security reasons or non-payment. Service credits or refunds are limited to fees paid in
          the last billing period. Nothing in this agreement limits your non-excludable rights under Australian Consumer Law.
          You must ensure PayTo instructions are honoured and maintain sufficient funds for BAS remittances.
        </p>
        <ul style={listStyle}>
          <li>Support channels: compliance@apgms.example, +61 2 5555 0000 (business hours).</li>
          <li>Incident SLAs: critical incidents acknowledged within 15 minutes, resolved within 4 hours.</li>
          <li>Governing law: New South Wales, Australia. Venue: NSW courts.</li>
        </ul>
      </LegalSection>

      <LegalSection id="privacy" title="Privacy Policy">
        <p style={paragraphStyle}>
          We collect only the data needed to administer tax obligations: identity data (ABN, ACN, TFN tokens), payroll
          transactions, reconciliation artefacts, and PayTo mandate references. TFNs are encrypted at rest, masked in logs, and
          only released to vetted compliance administrators on a need-to-know basis. Access reviews run quarterly and are
          auditable in the regulator portal.
        </p>
        <p style={paragraphStyle}>
          Customer data is stored in Australia (AWS ap-southeast-2). Backups remain onshore and are encrypted using AWS KMS.
          You may request a copy of your data or deletion (subject to statutory retention requirements) by emailing
          privacy@apgms.example. Automated jobs purge inactive TFN/ABN data 30 days after an organisation churns.
        </p>
        <ul style={listStyle}>
          <li>Lawful basis: consent plus legitimate interest for delivering BAS, STP, and reconciliation services.</li>
          <li>Subprocessors: Auth0 (identity), AWS (hosting), SendGrid (notifications), Atlassian (support tickets).</li>
          <li>Data retention: financial records 7 years, access logs 12 months, TFN lookups 30 days.</li>
        </ul>
      </LegalSection>

      <LegalSection id="direct-debit" title="Direct Debit Authority (PayTo)">
        <p style={paragraphStyle}>
          By granting the PayTo Direct Debit Authority you authorise APGMS Pty Ltd (ABN 51 824 753 556) to initiate payments
          from the nominated account for BAS shortfalls, PAYGW remittances, and agreed payment plans. Each debit notice is sent
          at least two business days in advance with the amount, reference, and dispute instructions.
        </p>
        <p style={paragraphStyle}>
          You can pause or cancel the authority via your bank or by contacting APGMS support. Cancelling the authority may
          impact BAS lodgements or result in manual payment requirements. We store an audit copy of your consent, including IP
          address, device fingerprint, and timestamp, which regulators can review on request.
        </p>
        <ul style={listStyle}>
          <li>Maximum debit per instruction: the shortfall amount plus any ATO-approved arrangement fees.</li>
          <li>Disputes: email payments@apgms.example within 3 business days with the transaction reference.</li>
          <li>Revocation: send a signed notice from an authorised signatory; processing time up to 2 business days.</li>
        </ul>
        <p style={paragraphStyle}>
          Need a PDF copy? Use the download button in the onboarding wizard or{" "}
          <Link style={{ color: "#0b5fff", fontWeight: 600 }} to="/onboarding">
            revisit onboarding
          </Link>{" "}
          to regenerate one instantly.
        </p>
      </LegalSection>
    </div>
  );
}
