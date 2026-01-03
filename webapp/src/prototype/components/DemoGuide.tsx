import React from "react";

export function DemoGuide(props: { onClose: () => void }) {
  return (
    <div className="apgms-proto__drawer" role="dialog" aria-label="Demo guide">
      <div className="closeRow">
        <h2>Demo Guide (production-like talk track)</h2>
        <button className="apgms-proto__btn secondary" onClick={props.onClose}>Close</button>
      </div>

      <div className="apgms-proto__muted">
        <p style={{ marginTop: 0 }}>
          Open with: <strong>“APGMS is a control-plane and evidence system for tax obligations.”</strong>
        </p>

        <h3>Sequence</h3>
        <ol>
          <li><strong>Dashboard:</strong> period switcher, tiles, activity timeline. Toggle Simulation ON.</li>
          <li><strong>Obligations:</strong> open one obligation. Run reconciliation. Prepare lodgment. Submit lodgment (demo). Queue payment (demo). Generate evidence pack.</li>
          <li><strong>Ledger:</strong> show audit spine and filter to the obligation you just processed.</li>
          <li><strong>Reconciliation:</strong> show unmatched vs suggested lines and resolution gate behavior.</li>
          <li><strong>Evidence Pack:</strong> open the pack. Emphasize reproducibility and manifest hashes.</li>
          <li><strong>Controls & Policies:</strong> update a control and show audit event.</li>
          <li><strong>Incidents:</strong> create an incident and link to an obligation. Show it as risk on Dashboard.</li>
          <li><strong>Settings:</strong> organization, accounts, integrations, security, retention, export defaults, analytics, simulation frequency, and Reset state.</li>
          <li><strong>Regulator Portal:</strong> read-only summary + packs + incidents.</li>
        </ol>

        <h3>Simulation notes</h3>
        <ul>
          <li>Default incoming feed cadence is <strong>60 seconds</strong> (configurable in Settings).</li>
          <li>Simulation is deterministic enough for repeatable demos.</li>
        </ul>
      </div>
    </div>
  );
}
