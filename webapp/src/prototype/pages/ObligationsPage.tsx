import React, { useMemo, useState } from "react";
import { usePrototype } from "../store";
import { formatAUD } from "../mockData";

export default function ObligationsPage() {
  const { state, runReconciliation, prepareLodgment, submitLodgmentDemo, queuePaymentDemo, generateEvidencePack } = usePrototype();
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(() => state.obligations.filter((o) => o.period === state.period), [state.obligations, state.period]);
  const active = list.find((o) => o.id === selected) ?? null;

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Obligations</h3>
        <div className="apgms-proto__muted">
          Workflow engine view. We enforce preconditions before lodgment or payment (demo gates).
        </div>
      </div>

      <div className="apgms-proto__card">
        <table className="apgms-proto__table">
          <thead>
            <tr>
              <th>Tax type</th>
              <th>Obligation</th>
              <th>Due date</th>
              <th>Amount due</th>
              <th>Stage</th>
              <th>Funded</th>
              <th>Recon open</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} onClick={() => setSelected(o.id)} style={{ cursor: "pointer" }}>
                <td>{o.taxType}</td>
                <td>{o.label}</td>
                <td className="apgms-proto__muted">{o.dueDate}</td>
                <td>{formatAUD(o.amountDueAUD)}</td>
                <td>{o.stage}</td>
                <td>{o.fundedPct}%</td>
                <td>{o.reconcileOpen}</td>
                <td className="apgms-proto__muted">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active ? (
        <div className="apgms-proto__card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ marginTop: 0 }}>{active.label}</h3>
              <div className="apgms-proto__muted">
                Lifecycle: Fund then Reconcile then Lodge then Pay then Evidence.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="apgms-proto__btn" onClick={() => runReconciliation(active.id)}>
                Run reconciliation
              </button>
              <button className="apgms-proto__btn" onClick={() => prepareLodgment(active.id)}>
                Prepare lodgment
              </button>
              <button className="apgms-proto__btn" onClick={() => submitLodgmentDemo(active.id)}>
                Submit lodgment (demo)
              </button>
              <button className="apgms-proto__btn" onClick={() => queuePaymentDemo(active.id)}>
                Queue payment (demo)
              </button>
              <button className="apgms-proto__btn" onClick={() => generateEvidencePack(active.id)}>
                Generate evidence pack
              </button>
            </div>
          </div>

          <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
            <strong>Blockers:</strong> {active.blockers.length ? active.blockers.join("; ") : "None"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
