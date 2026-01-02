import React, { useMemo, useState } from "react";
import { Card, Tag } from "../components/ui";
import { formatAud } from "../mockData";
import { usePrototype } from "../store";

export default function LedgerPage() {
  const { state } = usePrototype();
  const [account, setAccount] = useState<string>("all");

  const rows = useMemo(() => {
    const all = state.ledger.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1));
    if (account === "all") return all;
    return all.filter((e) => e.account === account);
  }, [state.ledger, account]);

  const accounts = ["all", "Operating", "Tax Buffer", "GST Holding", "PAYGW Holding", "Super Holding"];

  return (
    <div className="apgms-grid">
      <div className="apgms-col-12">
        <Card
          title="Ledger"
          right={
            <div className="apgms-row">
              <span className="apgms-muted" style={{ fontSize: 12 }}>Account</span>
              <select className="apgms-input" style={{ width: 180 }} value={account} onChange={(e) => setAccount(e.target.value)}>
                {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          }
        >
          <table className="apgms-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Account</th>
                <th>Dir</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Counterparty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="apgms-muted">{new Date(e.ts).toLocaleString()}</td>
                  <td style={{ fontWeight: 800 }}>{e.account}</td>
                  <td><Tag tone={e.direction === "in" ? "good" : "warn"}>{e.direction}</Tag></td>
                  <td>{formatAud(e.amountCents)}</td>
                  <td className="apgms-muted">{e.reference}</td>
                  <td className="apgms-muted">{e.counterparty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
