import React, { useMemo, useState } from "react";
import { usePrototype, describeTs } from "../store";
import { formatAUD } from "../mockData";

export default function LedgerPage() {
  const { state } = usePrototype();
  const [filterOb, setFilterOb] = useState<string>("");

  const obs = useMemo(() => state.obligations.filter((o) => o.period === state.period), [state.obligations, state.period]);

  const rows = useMemo(() => {
    let x = state.ledger.filter((l) => l.period === state.period);
    if (filterOb) x = x.filter((l) => l.obligationId === filterOb);
    return x.slice(0, 60);
  }, [state.ledger, state.period, filterOb]);

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Ledger</h3>
        <div className="apgms-proto__muted">
          Audit spine. Every derived figure traces to ledger entries and events.
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="apgms-proto__muted">Filter obligation:</div>
          <select className="apgms-proto__select" value={filterOb} onChange={(e) => setFilterOb(e.target.value)}>
            <option value="">All</option>
            {obs.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="apgms-proto__card">
        <table className="apgms-proto__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Account</th>
              <th>Dir</th>
              <th>Amount</th>
              <th>Obligation</th>
              <th>Source</th>
              <th>Memo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="apgms-proto__muted">{describeTs(l.ts)}</td>
                <td>{l.account}</td>
                <td className="apgms-proto__muted">{l.direction}</td>
                <td>{formatAUD(l.amountAUD)}</td>
                <td className="apgms-proto__muted">{l.obligationId}</td>
                <td className="apgms-proto__muted">{l.source}</td>
                <td className="apgms-proto__muted">{l.memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
