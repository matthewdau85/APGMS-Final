import React from "react";
import { useDemoStore } from "../store";
import { StatTile } from "../components/StatTile";
import { StatusPill } from "../components/StatusPill";

export default function DashboardPage() {
  const { period, obligations, events, settings } = useDemoStore();

  const funded = obligations.filter((o) => o.status === "funded").length;
  const reconcilePending = obligations.filter((o) => o.status === "reconcile_pending").length;
  const readyToLodge = obligations.filter((o) => o.status === "ready_to_lodge").length;
  const overdueRisk = obligations.filter((o) => o.status === "overdue_risk").length;

  return (
    <div className="apgms-proto__section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="apgms-proto__h1">Dashboard</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Operational truth by period. All actions produce events that can be packaged into evidence."}
          </div>
        </div>
        <div>
          <StatusPill text={"Period: " + period} />
          <span style={{ marginLeft: 8 }} />
          <StatusPill text={"Simulation: " + (settings.simulation.enabled ? "ON" : "OFF")} />
          <span style={{ marginLeft: 8 }} />
          <StatusPill text={"Feed interval: " + settings.simulation.feedIntervalSeconds + "s"} />
        </div>
      </div>

      <div className="apgms-proto__grid">
        <StatTile title="Funded" value={String(funded)} note="Funding controls satisfied." />
        <StatTile title="Reconcile pending" value={String(reconcilePending)} note="Inputs not yet cleared." />
        <StatTile title="Ready to lodge" value={String(readyToLodge)} note="Controls satisfied, payload can be prepared." />
        <StatTile title="Overdue risk" value={String(overdueRisk)} note="Approaching due date or exception state." />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>Recent activity</div>
        <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
          {"This is event-backed. Evidence packs include the event timeline + hashes (demo)."}
        </div>

        <table className="apgms-proto__table">
          <thead>
            <tr>
              <th style={{ width: 190 }}>Time</th>
              <th style={{ width: 180 }}>Type</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 12).map((e) => (
              <tr key={e.id}>
                <td style={{ opacity: 0.8 }}>{new Date(e.ts).toLocaleString()}</td>
                <td><StatusPill text={e.type} /></td>
                <td style={{ opacity: 0.9 }}>{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
