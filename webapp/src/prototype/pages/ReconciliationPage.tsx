import React from "react";
import { useDemoStore } from "../store";
import { formatMoney } from "../mockData";
import { StatusPill } from "../components/StatusPill";

export default function ReconciliationPage() {
  const { bankLines, resolveBankLine } = useDemoStore();

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Reconciliation</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Control gate. Lodgment should not proceed on unverified inputs. Resolve exceptions and re-run reconciliation in the obligation view."}
      </div>

      <table className="apgms-proto__table">
        <thead>
          <tr>
            <th style={{ width: 190 }}>Time</th>
            <th>Description</th>
            <th style={{ width: 140 }}>Amount</th>
            <th style={{ width: 140 }}>Status</th>
            <th style={{ width: 240 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bankLines.slice(0, 60).map((b) => (
            <tr key={b.id}>
              <td style={{ opacity: 0.8 }}>{new Date(b.ts).toLocaleString()}</td>
              <td style={{ opacity: 0.9 }}>
                {b.description}
                <div className="apgms-proto__muted" style={{ marginTop: 4 }}>Line ID: {b.id}</div>
              </td>
              <td style={{ opacity: 0.9 }}>{formatMoney(b.amountCents)}</td>
              <td><StatusPill text={b.status} /></td>
              <td>
                {b.status === "unmatched" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="apgms-proto__btn" onClick={() => resolveBankLine(b.id, "business")}>Mark business</button>
                    <button className="apgms-proto__btn" onClick={() => resolveBankLine(b.id, "tax")}>Mark tax</button>
                    <button className="apgms-proto__btn" onClick={() => resolveBankLine(b.id, "excluded")}>Exclude</button>
                  </div>
                ) : (
                  <span className="apgms-proto__muted">No action required</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
