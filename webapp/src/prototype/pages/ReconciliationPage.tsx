import React, { useMemo } from "react";
import { usePrototype, describeTs } from "../store";
import { formatAUD } from "../mockData";

export default function ReconciliationPage() {
  const { state } = usePrototype();
  const lines = useMemo(() => state.bankLines.filter((b) => b.period === state.period).slice(0, 80), [state.bankLines, state.period]);

  const counts = useMemo(() => {
    const matched = lines.filter((l) => l.status === "matched").length;
    const unmatched = lines.filter((l) => l.status === "unmatched").length;
    const suggested = lines.filter((l) => l.status === "suggested").length;
    return { matched, unmatched, suggested };
  }, [lines]);

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Reconciliation</h3>
        <div className="apgms-proto__muted">
          Control gate. Demo rule: we do not allow lodgment based on unverified inputs.
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <span className="apgms-proto__pill">Matched: {counts.matched}</span>
          <span className="apgms-proto__pill warn">Suggested: {counts.suggested}</span>
          <span className="apgms-proto__pill bad">Unmatched: {counts.unmatched}</span>
        </div>
      </div>

      <div className="apgms-proto__card">
        <table className="apgms-proto__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Suggestion</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="apgms-proto__muted">{describeTs(l.ts)}</td>
                <td>{l.description}</td>
                <td>{formatAUD(l.amountAUD)}</td>
                <td className="apgms-proto__muted">{l.status}</td>
                <td className="apgms-proto__muted">{l.suggestedObligationId ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
