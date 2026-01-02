import React from "react";
import { Button, Card, Tag } from "../components/ui";
import { usePrototype } from "../store";

export default function ReconciliationPage() {
  const { state, actions } = usePrototype();
  const r = state.reconciliation;

  const tone = r.unmatchedCount === 0 ? "good" : r.unmatchedCount <= 2 ? "warn" : "bad";

  return (
    <div className="apgms-grid">
      <div className="apgms-col-12">
        <Card
          title="Reconciliation"
          right={<Button onClick={actions.runReconciliation}>Run reconciliation</Button>}
        >
          <div className="apgms-row" style={{ marginBottom: 10 }}>
            <Tag tone={tone}>
              {r.lastRunAt ? "Last run: " + new Date(r.lastRunAt).toLocaleString() : "Not run this session"}
            </Tag>
            <Tag tone={r.unmatchedCount === 0 ? "good" : "warn"}>Matched: {r.matchedCount}</Tag>
            <Tag tone={r.unmatchedCount === 0 ? "good" : "bad"}>Unmatched: {r.unmatchedCount}</Tag>
          </div>

          <div className="apgms-muted" style={{ lineHeight: 1.5 }}>
            {r.notes}
            <br />
            In production, this page becomes your workflow: ingest feeds → normalize ledger → map to obligations → identify shortfalls/excess → generate attestable evidence.
          </div>

          <div style={{ marginTop: 12 }}>
            <Card title="Mock review queue">
              <table className="apgms-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Reason</th>
                    <th>Suggested action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>GST Holding sweep</td>
                    <td className="apgms-muted">Timing mismatch vs weekly rule</td>
                    <td className="apgms-muted">Re-run sweep window (mock)</td>
                  </tr>
                  <tr>
                    <td>PAYGW Holding allocation</td>
                    <td className="apgms-muted">Policy threshold not met</td>
                    <td className="apgms-muted">Top-up from Tax Buffer (mock)</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>
        </Card>
      </div>
    </div>
  );
}
