import React from "react";
import { Link } from "react-router-dom";
import { useDemoStore } from "../store";
import { formatMoney } from "../mockData";
import { StatusPill } from "../components/StatusPill";

export default function ObligationsPage() {
  const { obligations } = useDemoStore();

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Obligations</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Workflow engine view. Preconditions block lodgment and payment until inputs are reconciled and controlled."}
      </div>

      <table className="apgms-proto__table">
        <thead>
          <tr>
            <th style={{ width: 120 }}>Tax type</th>
            <th>Obligation</th>
            <th style={{ width: 140 }}>Due date</th>
            <th style={{ width: 140 }}>Amount</th>
            <th style={{ width: 160 }}>Status</th>
            <th style={{ width: 120 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {obligations.map((o) => (
            <tr key={o.id}>
              <td><StatusPill text={o.taxType} /></td>
              <td style={{ fontWeight: 700 }}>{o.label}</td>
              <td style={{ opacity: 0.8 }}>{o.dueDate}</td>
              <td style={{ opacity: 0.9 }}>{formatMoney(o.amountCents)}</td>
              <td><StatusPill text={o.status} /></td>
              <td>
                <Link to={"/proto/obligations/" + encodeURIComponent(o.id)} style={{ color: "inherit" }}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
