import React, { useMemo } from "react";
import { Button, Card, Tag } from "../components/ui";
import { formatAud } from "../mockData";
import { usePrototype } from "../store";

export default function ObligationsPage() {
  const { state, actions } = usePrototype();

  const rows = useMemo(
    () => state.obligations.filter((o) => o.period === state.currentPeriod),
    [state.currentPeriod, state.obligations]
  );

  return (
    <div className="apgms-grid">
      <div className="apgms-col-12">
        <Card title="Obligations">
          <div className="apgms-muted" style={{ marginBottom: 10 }}>
            Mocked obligations and mocked lodgment/payment actions. This is the UX pattern you will wire to real policy + ledger later.
          </div>

          <table className="apgms-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Due</th>
                <th>Status</th>
                <th>Due</th>
                <th>Funded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 900 }}>{o.type}</td>
                  <td>{o.dueDate}</td>
                  <td>
                    <Tag tone={o.status === "paid" || o.status === "lodged" ? "good" : o.status === "blocked" || o.status === "overdue" ? "bad" : "warn"}>
                      {o.status}
                    </Tag>
                  </td>
                  <td>{formatAud(o.amountDueCents)}</td>
                  <td>{formatAud(o.fundedCents)}</td>
                  <td>
                    <div className="apgms-row">
                      <Button variant="ghost" onClick={() => actions.lodgeObligation(o.id)} disabled={o.status === "lodged" || o.status === "paid"}>
                        Mock Lodge
                      </Button>
                      <Button variant="ghost" onClick={() => actions.markPaid(o.id)} disabled={o.status === "paid"}>
                        Mark Paid
                      </Button>
                      <Button variant="ghost" onClick={() => actions.setObligationStatus(o.id, "blocked")}>
                        Block
                      </Button>
                      <Button variant="ghost" onClick={() => actions.setObligationStatus(o.id, "ready")}>
                        Ready
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="apgms-muted">No obligations for this period.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
