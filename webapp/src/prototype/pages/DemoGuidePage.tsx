import React from "react";
import { Link } from "react-router-dom";
import { useDemoStore } from "../store";

export default function DemoGuidePage() {
  const { settings, toggleSimulation, resetDemoState } = useDemoStore();

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Demo Guide</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Use this for self-serve or keep DEMO_RUNBOOK.md as your live talk track. This page is intentionally short and click-driven."}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={() => toggleSimulation(!settings.simulation.enabled)}>
          {"Simulation: " + (settings.simulation.enabled ? "ON" : "OFF")}
        </button>
        <button className="apgms-proto__btn" onClick={resetDemoState}>Reset demo state</button>
      </div>

      <ol style={{ marginTop: 12, paddingLeft: 18, lineHeight: 1.6, opacity: 0.9 }}>
        <li>
          <Link to="/proto/dashboard" style={{ color: "inherit" }}>Dashboard</Link>: confirm period, tiles, recent activity.
        </li>
        <li>
          <Link to="/proto/obligations" style={{ color: "inherit" }}>Obligations</Link>: open BAS, run reconciliation, prepare and submit lodgment, generate evidence pack.
        </li>
        <li>
          <Link to="/proto/ledger" style={{ color: "inherit" }}>Ledger</Link>: filter to obligation and show traceability.
        </li>
        <li>
          <Link to="/proto/reconciliation" style={{ color: "inherit" }}>Reconciliation</Link>: resolve an unmatched feed line if present.
        </li>
        <li>
          <Link to="/proto/evidence" style={{ color: "inherit" }}>Evidence Pack</Link>: open latest pack and show manifest hash + diff note.
        </li>
        <li>
          <Link to="/proto/controls" style={{ color: "inherit" }}>Controls & Policies</Link>: save a change to generate a policy event.
        </li>
        <li>
          <Link to="/proto/incidents" style={{ color: "inherit" }}>Incidents</Link>: create a "Feed delay" incident and link an obligation.
        </li>
        <li>
          <Link to="/proto/settings" style={{ color: "inherit" }}>Settings</Link>: show deployable configuration sections and simulation interval (less frequent by default).
        </li>
        <li>
          <Link to="/proto/regulator" style={{ color: "inherit" }}>Regulator Portal</Link>: show read-only compliance summary and packs/incidents counters.
        </li>
      </ol>

      <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
        {"Tip: For a live demo, follow DEMO_RUNBOOK.md. For self-serve demos, this page is sufficient."}
      </div>
    </div>
  );
}
