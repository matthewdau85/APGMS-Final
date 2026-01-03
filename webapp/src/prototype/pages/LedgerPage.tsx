import React, { useMemo, useState } from "react";
import { useDemoStore } from "../store";
import { formatMoney } from "../mockData";
import { StatusPill } from "../components/StatusPill";

export default function LedgerPage() {
  const { ledger, obligations, period } = useDemoStore();
  const [filterOb, setFilterOb] = useState<string>("");

  const rows = useMemo(() => {
    const base = ledger.filter((l) => l.period === period);
    if (!filterOb) return base;
    return base.filter((l) => l.obligationId === filterOb);
  }, [ledger, period, filterOb]);

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Ledger</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Audit spine. Derived figures trace back to ledger entries and events."}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select className="apgms-proto__input" value={filterOb} onChange={(e) => setFilterOb(e.target.value)}>
          <option value="">All obligations</option>
          {obligations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.taxType + " - " + o.period}
            </option>
          ))}
        </select>

        <StatusPill text={"Rows: " + String(rows.length)} />
      </div>

      <table className="apgms-proto__table">
        <thead>
          <tr>
            <th style={{ width: 190 }}>Time</th>
            <th style={{ width: 120 }}>Account</th>
            <th style={{ width: 120 }}>Direction</th>
            <th style={{ width: 140 }}>Amount</th>
            <th style={{ width: 160 }}>Source</th>
            <th>Memo</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((l) => (
            <tr key={l.id}>
              <td style={{ opacity: 0.8 }}>{new Date(l.ts).toLocaleString()}</td>
              <td><StatusPill text={l.account} /></td>
              <td><StatusPill text={l.direction} /></td>
              <td style={{ opacity: 0.9 }}>{formatMoney(l.amountCents)}</td>
              <td style={{ opacity: 0.85 }}>{l.source}</td>
              <td style={{ opacity: 0.9 }}>{l.memo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
