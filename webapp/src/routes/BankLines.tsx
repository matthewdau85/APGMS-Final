import React from "react";
import { Link } from "react-router-dom";

export default function BankLines() {
  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Bank Lines</h1>
        <p style={{ marginTop: 8, opacity: 0.85 }}>
          Prototype UI route for reviewing imported bank transactions and mapping them to ledger events.
        </p>
      </header>

      <section
        aria-label="Bank line items"
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <p style={{ marginTop: 0 }}>
          This page is currently a placeholder so routing, accessibility checks, and future integrations
          can proceed without blocking typecheck.
        </p>

        <ul style={{ margin: "12px 0 0 18px" }}>
          <li>Import source: connector (bank feed / CSV)</li>
          <li>Normalization: date, amount, counterparty, reference</li>
          <li>Matching: link to obligations, journals, or reconciliations</li>
          <li>Controls: audit events for user actions (approve/reject/match)</li>
        </ul>

        <div style={{ marginTop: 16 }}>
          <Link to="/" style={{ textDecoration: "underline" }}>
            Back to Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
