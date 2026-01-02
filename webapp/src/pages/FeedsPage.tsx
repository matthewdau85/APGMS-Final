import React from "react";
import { apiGet } from "../../api/client";
import { usePrototypeContext } from "../usePrototypeContext";
import "../../ui/ui.css";

type BankFeed = { ok: boolean; transactions: Array<any> };
type PayrollFeed = { ok: boolean; events: Array<any> };

export default function FeedsPage() {
  const { period } = usePrototypeContext();
  const [bank, setBank] = React.useState<BankFeed | null>(null);
  const [payroll, setPayroll] = React.useState<PayrollFeed | null>(null);

  React.useEffect(() => {
    let alive = true;
    apiGet<BankFeed>(`/prototype/feeds/bank?period=${encodeURIComponent(period)}`)
      .then((d) => alive && setBank(d))
      .catch(() => alive && setBank(null));

    apiGet<PayrollFeed>(`/prototype/feeds/payroll?period=${encodeURIComponent(period)}`)
      .then((d) => alive && setPayroll(d))
      .catch(() => alive && setPayroll(null));

    return () => {
      alive = false;
    };
  }, [period]);

  return (
    <div className="grid">
      <div className="card col6">
        <h1 className="h1">Bank Feed</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Mocked import feed (bank transactions)
        </p>

        <table className="table" aria-label="Bank feed table">
          <thead>
            <tr>
              <th>At</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(bank?.transactions ?? []).map((t: any) => (
              <tr key={t.id}>
                <td className="muted">{t.at}</td>
                <td>{t.description}</td>
                <td className="muted">{t.amount}</td>
                <td>
                  <span className={`chip ${t.status === "flagged" ? "red" : t.status === "unreconciled" ? "amber" : "green"}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card col6">
        <h1 className="h1">Payroll Feed</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Mocked import feed (pay events)
        </p>

        <table className="table" aria-label="Payroll feed table">
          <thead>
            <tr>
              <th>Pay date</th>
              <th>Gross</th>
              <th>Tax</th>
              <th>Super</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(payroll?.events ?? []).map((e: any) => (
              <tr key={e.id}>
                <td className="muted">{e.payDate}</td>
                <td className="muted">{e.gross}</td>
                <td className="muted">{e.taxWithheld}</td>
                <td className="muted">{e.super}</td>
                <td>
                  <span className={`chip ${e.status === "review" ? "amber" : e.status === "matched" ? "green" : ""}`}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
