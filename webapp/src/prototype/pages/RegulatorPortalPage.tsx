import React from "react";
import { useDemoStore } from "../store";
import { StatusPill } from "../components/StatusPill";

export default function RegulatorPortalPage() {
  const { period, obligations, evidencePacks, incidents, settings } = useDemoStore();

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Regulator Portal (read-only)</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Assessor view: minimum necessary access, reproducible artifacts, and no write actions."}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatusPill text={"Period: " + period} />
        <StatusPill text={"Portal: " + (settings.export.regulatorPortalEnabled ? "ENABLED" : "DISABLED")} />
        <StatusPill text={"Obligations: " + String(obligations.length)} />
        <StatusPill text={"Packs: " + String(evidencePacks.filter((p) => p.period === period).length)} />
        <StatusPill text={"Incidents: " + String(incidents.filter((i) => i.period === period).length)} />
      </div>

      <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
        <div style={{ fontWeight: 900 }}>Compliance summary (demo)</div>
        <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
          {"This mirrors the endpoint-backed view. In production this would be read-only and backed by signed evidence pack artifacts."}
        </div>

        <table className="apgms-proto__table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Tax type</th>
              <th>Obligation</th>
              <th style={{ width: 160 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {obligations.map((o) => (
              <tr key={o.id}>
                <td><StatusPill text={o.taxType} /></td>
                <td style={{ opacity: 0.9 }}>{o.label}</td>
                <td><StatusPill text={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }} className="apgms-proto__muted">
        {"No controls are available here. This is intentionally read-only."}
      </div>
    </div>
  );
}
