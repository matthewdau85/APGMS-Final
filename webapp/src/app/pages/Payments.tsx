import React from "react";

/**
 * Payments (prototype)
 * This page exists so the Layout nav doesn't point to a dead route.
 * Next step: wire to your ledger/payment scheduling flows.
 */
export default function Payments() {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Payments</h1>
      <p style={{ marginTop: 8, maxWidth: 760 }}>
        This is a placeholder page so routing is deterministic.
        Next: connect this to scheduled payments, one-way tax accounts, and payment status.
      </p>
    </div>
  );
}
