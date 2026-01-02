import React, { useMemo } from "react";
import { Card, Tag } from "../components/ui";
import { usePrototype } from "../store";

export default function RegulatorPortalPage() {
  const { state } = usePrototype();

  const period = state.currentPeriod;
  const obligations = useMemo(() => state.obligations.filter((o) => o.period === period), [state.obligations, period]);
  const packs = useMemo(() => state.evidencePacks.filter((p) => p.period === period), [state.evidencePacks, period]);

  const readiness = useMemo(() => {
    const blocked = obligations.filter((o) => o.status === "blocked" || o.status === "overdue").length;
    const ready = obligations.filter((o) => o.status === "ready" || o.status === "lodged" || o.status === "paid").length;
    return { blocked, ready };
  }, [obligations]);

  return (
    <div className="apgms-grid">
      <div className="apgms-col-12">
        <Card title="Regulator Portal (read-only)">
          <div className="apgms-muted" style={{ lineHeight: 1.5 }}>
            This page is a UX stub for a regulator-facing view. In production, it must be strictly read-only, audience-limited,
            and backed by attestable evidence packs with immutable manifests.
          </div>

          <div className="apgms-row" style={{ marginTop: 10 }}>
            <Tag tone={readiness.blocked > 0 ? "bad" : "good"}>Blocked/Overdue: {readiness.blocked}</Tag>
            <Tag tone={readiness.ready > 0 ? "good" : "warn"}>Ready/Lodged/Paid: {readiness.ready}</Tag>
            <Tag tone="muted">Period: {period}</Tag>
          </div>
        </Card>
      </div>

      <div className="apgms-col-7">
        <Card title="Obligation snapshot">
          <table className="apgms-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Due</th>
                <th>Status</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 900 }}>{o.type}</td>
                  <td>{o.dueDate}</td>
                  <td>
                    <Tag tone={o.status === "paid" || o.status === "lodged" ? "good" : o.status === "blocked" || o.status === "overdue" ? "bad" : "warn"}>
                      {o.status}
                    </Tag>
                  </td>
                  <td className="apgms-muted">{new Date(o.lastUpdated).toLocaleString()}</td>
                </tr>
              ))}
              {obligations.length === 0 && (
                <tr><td colSpan={4} className="apgms-muted">No obligations for this period.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="apgms-col-5">
        <Card title="Evidence packs available">
          <table className="apgms-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id}>
                  <td className="apgms-muted">{new Date(p.createdAt).toLocaleString()}</td>
                  <td style={{ fontWeight: 900 }}>{p.id}</td>
                </tr>
              ))}
              {packs.length === 0 && (
                <tr><td colSpan={2} className="apgms-muted">No evidence packs for this period.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
