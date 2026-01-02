import React, { useMemo } from "react";
import { Card, Tag } from "../components/ui";
import { formatAud } from "../mockData";
import { usePrototype } from "../store";

export default function DashboardPage() {
  const { state } = usePrototype();

  const periodObligations = useMemo(
    () => state.obligations.filter((o) => o.period === state.currentPeriod),
    [state.currentPeriod, state.obligations]
  );

  const totals = useMemo(() => {
    const due = periodObligations.reduce((a, o) => a + o.amountDueCents, 0);
    const funded = periodObligations.reduce((a, o) => a + o.fundedCents, 0);
    const ready = periodObligations.filter((o) => o.status === "ready").length;
    const blocked = periodObligations.filter((o) => o.status === "blocked").length;
    return { due, funded, ready, blocked };
  }, [periodObligations]);

  const healthTone =
    totals.blocked > 0 ? "bad" : totals.ready > 0 ? "good" : "warn";

  return (
    <div className="apgms-grid">
      <div className="apgms-col-12">
        <Card
          title="Environment health"
          right={<Tag tone={healthTone}>{healthTone === "good" ? "Green" : healthTone === "warn" ? "Amber" : "Red"}</Tag>}
        >
          <div className="apgms-muted" style={{ lineHeight: 1.5 }}>
            This is a production-look dashboard with mocked obligations, ledger, reconciliation, evidence packs,
            controls, incidents, and a read-only regulator view. Use the top bar buttons to simulate feeds + evidence pack generation.
          </div>
        </Card>
      </div>

      <div className="apgms-col-4">
        <Card title="Period due (AUD)">
          <div style={{ fontSize: 22, fontWeight: 900 }}>{formatAud(totals.due)}</div>
          <div className="apgms-muted" style={{ marginTop: 6 }}>Total liability across obligations for {state.currentPeriod}.</div>
        </Card>
      </div>

      <div className="apgms-col-4">
        <Card title="Funded (AUD)">
          <div style={{ fontSize: 22, fontWeight: 900 }}>{formatAud(totals.funded)}</div>
          <div className="apgms-muted" style={{ marginTop: 6 }}>Funds reserved in holding accounts (mock).</div>
        </Card>
      </div>

      <div className="apgms-col-4">
        <Card title="Readiness">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Tag tone={totals.ready > 0 ? "good" : "warn"}>{totals.ready} ready</Tag>
            <Tag tone={totals.blocked > 0 ? "bad" : "muted"}>{totals.blocked} blocked</Tag>
          </div>
          <div className="apgms-muted" style={{ marginTop: 6 }}>Readiness is mocked based on obligation statuses.</div>
        </Card>
      </div>

      <div className="apgms-col-8">
        <Card title="Upcoming obligations (current period)">
          <table className="apgms-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Due</th>
                <th>Status</th>
                <th>Due</th>
                <th>Funded</th>
              </tr>
            </thead>
            <tbody>
              {periodObligations.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 800 }}>{o.type}</td>
                  <td>{o.dueDate}</td>
                  <td>
                    <Tag tone={o.status === "paid" || o.status === "lodged" ? "good" : o.status === "blocked" || o.status === "overdue" ? "bad" : "warn"}>
                      {o.status}
                    </Tag>
                  </td>
                  <td>{formatAud(o.amountDueCents)}</td>
                  <td>{formatAud(o.fundedCents)}</td>
                </tr>
              ))}
              {periodObligations.length === 0 && (
                <tr><td colSpan={5} className="apgms-muted">No obligations in this period.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="apgms-col-4">
        <Card title="Feeds (mock)">
          <div className="apgms-muted" style={{ marginBottom: 8 }}>
            Last ingest: {state.feeds.lastIngestAt ?? "not yet"}
          </div>
          <table className="apgms-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Kind</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.feeds.items.slice(0, 6).map((f) => (
                <tr key={f.id}>
                  <td>{f.source}</td>
                  <td>{f.kind}</td>
                  <td>
                    <Tag tone={f.status === "ok" ? "good" : f.status === "warn" ? "warn" : "bad"}>{f.status}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
