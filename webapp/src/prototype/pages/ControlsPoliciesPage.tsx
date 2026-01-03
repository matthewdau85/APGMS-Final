import React, { useState } from "react";
import { useDemoStore } from "../store";
import { StatusPill } from "../components/StatusPill";

export default function ControlsPoliciesPage() {
  const { settings, updatePolicy } = useDemoStore();
  const [fundingCadence, setFundingCadence] = useState("weekly");
  const [matchThreshold, setMatchThreshold] = useState("strict");
  const [adminOnlyActions, setAdminOnlyActions] = useState("enabled");

  const save = () => {
    updatePolicy("funding.cadence", fundingCadence);
    updatePolicy("reconciliation.matchThreshold", matchThreshold);
    updatePolicy("access.adminOnlyActions", adminOnlyActions);
  };

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Controls & Policies</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Controls are explicit and versioned. You can show which policy version was in force for any event (demo)."}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Funding policy</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Buffer rules, allocation cadence, and blocking behavior for shortfalls (demo)."}
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="apgms-proto__muted">Allocation cadence</label>
            <select className="apgms-proto__input" value={fundingCadence} onChange={(e) => setFundingCadence(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
              <option value="per_payrun">Per pay run</option>
              <option value="weekly">Weekly</option>
              <option value="ramp_up">Ramp-up near due date</option>
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Reconciliation policy</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Matching thresholds and blocking rules (demo)."}
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="apgms-proto__muted">Match threshold</label>
            <select className="apgms-proto__input" value={matchThreshold} onChange={(e) => setMatchThreshold(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
              <option value="strict">Strict</option>
              <option value="balanced">Balanced</option>
              <option value="permissive">Permissive</option>
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Access policy</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"Admin-only actions and least-privilege enforcement (demo)."}
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="apgms-proto__muted">Admin-only actions</label>
            <select className="apgms-proto__input" value={adminOnlyActions} onChange={(e) => setAdminOnlyActions(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
              <option value="enabled">Enabled</option>
              <option value="disabled_demo">Disabled (demo)</option>
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Current settings snapshot</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            {"In production, policy versions are included in evidence packs and event metadata."}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill text={"Segregated account: " + (settings.accounts.segregatedAccountEnabled ? "ON" : "OFF")} />
            <StatusPill text={"MFA for admin: " + (settings.security.mfaRequiredForAdmin ? "ON" : "OFF")} />
            <StatusPill text={"Regulator portal: " + (settings.export.regulatorPortalEnabled ? "ON" : "OFF")} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={save}>Save policy changes (demo)</button>
        <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
          {"Saving produces a policy update event so it can be evidenced later."}
        </div>
      </div>
    </div>
  );
}
