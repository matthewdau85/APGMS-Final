import React from "react";
import { Link, useParams } from "react-router-dom";
import { useDemoStore } from "../store";
import { formatMoney } from "../mockData";
import { StatusPill } from "../components/StatusPill";

export default function ObligationDetailPage() {
  const { obligationId } = useParams();
  const { obligations, runReconciliation, prepareLodgment, submitLodgment, generateEvidencePack } = useDemoStore();

  const ob = obligations.find((o) => o.id === obligationId);
  if (!ob) {
    return (
      <div className="apgms-proto__section">
        <div className="apgms-proto__h1">Obligation not found</div>
        <div className="apgms-proto__muted" style={{ marginTop: 8 }}>
          <Link to="/proto/obligations" style={{ color: "inherit" }}>Back to obligations</Link>
        </div>
      </div>
    );
  }

  const canLodge = ob.blockers.length === 0 && (ob.status === "ready_to_lodge" || ob.status === "lodged" || ob.status === "evidence_ready");
  const canEvidence = ob.status === "lodged" || ob.status === "evidence_ready";

  return (
    <div className="apgms-proto__section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="apgms-proto__h1">{ob.label}</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Lifecycle: Fund, Reconcile, Lodge, Pay, Evidence Pack. Controls block the next step until preconditions are met."}
          </div>
        </div>
        <div>
          <Link to="/proto/obligations" style={{ color: "inherit" }}>Back</Link>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatusPill text={ob.taxType} />
        <StatusPill text={"Due " + ob.dueDate} />
        <StatusPill text={"Amount " + formatMoney(ob.amountCents)} />
        <StatusPill text={"Status " + ob.status} />
      </div>

      {ob.blockers.length > 0 && (
        <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Blockers</div>
          <ul style={{ marginTop: 8, opacity: 0.85, paddingLeft: 18 }}>
            {ob.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={() => runReconciliation(ob.id)}>
          Run reconciliation
        </button>

        <button className="apgms-proto__btn" onClick={() => prepareLodgment(ob.id)} disabled={!canLodge}>
          Prepare lodgment (demo)
        </button>

        <button className="apgms-proto__btn" onClick={() => submitLodgment(ob.id)} disabled={!canLodge}>
          Submit lodgment (demo)
        </button>

        <button className="apgms-proto__btn" onClick={() => generateEvidencePack(ob.id)} disabled={!canEvidence}>
          Generate evidence pack
        </button>
      </div>

      <div style={{ marginTop: 14 }} className="apgms-proto__muted">
        {"Note: This demo keeps everything deterministic and event-backed. In production, these actions would be backed by connectors and signed evidence artifacts."}
      </div>
    </div>
  );
}
