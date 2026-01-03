import React, { useState } from "react";
import { usePrototype } from "../store";

export default function ControlsPoliciesPage() {
  const { state, updateSettings } = usePrototype();
  const [changed, setChanged] = useState(false);

  const s = state.settings;

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Controls & Policies</h3>
        <div className="apgms-proto__muted">
          Controls are explicit and versioned in production. In demo, we show the configuration surfaces that would drive those controls.
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Funding policy (demo)</h3>
        <div className="apgms-proto__muted">
          Labels reflect production intent (buffer rules, allocation cadence, gating conditions).
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div className="apgms-proto__muted"><strong>Tax buffer:</strong> {s.accounts.taxBufferLabel}</div>
          <div className="apgms-proto__muted"><strong>Retention (events):</strong> {s.retention.eventRetentionDays} days</div>
          <div className="apgms-proto__muted"><strong>Export defaults:</strong> timeline={String(s.exportDefaults.includeTimeline)}, payloadSnapshots={String(s.exportDefaults.includePayloadSnapshots)}</div>

          <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={s.exportDefaults.includeControlAttestation}
              onChange={(e) => {
                setChanged(true);
                updateSettings({ exportDefaults: { ...s.exportDefaults, includeControlAttestation: e.target.checked } });
              }}
            />
            Require controls attestation in evidence packs (demo)
          </label>

          {changed ? (
            <div className="apgms-proto__pill good">Policy updated (demo). This would generate an audit event in production.</div>
          ) : (
            <div className="apgms-proto__pill">No changes yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
