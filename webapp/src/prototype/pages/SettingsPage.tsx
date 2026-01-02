import React from "react";
import { Button, Card, Field, Tag } from "../components/ui";
import { usePrototype } from "../store";

export default function SettingsPage() {
  const { state, actions } = usePrototype();

  return (
    <div className="apgms-grid">
      <div className="apgms-col-6">
        <Card title="Org / Environment">
          <Field label="Org name">
            <div className="apgms-row">
              <Tag tone="muted">{state.settings.orgName}</Tag>
              <Tag tone="muted">Env: {state.settings.environment}</Tag>
            </div>
          </Field>

          <Field label="Regulator mode (UI read-only lock)">
            <div className="apgms-row">
              <Tag tone={state.settings.regulatorMode ? "warn" : "muted"}>
                {state.settings.regulatorMode ? "ON (read-only)" : "OFF"}
              </Tag>
              <Button variant="ghost" onClick={actions.toggleRegulatorMode}>
                Toggle
              </Button>
            </div>
          </Field>

          <div className="apgms-muted" style={{ lineHeight: 1.5 }}>
            In production, this is where you manage org switching, period governance, policy versions, audit settings,
            evidence retention, and regulator portal permissions.
          </div>
        </Card>
      </div>

      <div className="apgms-col-6">
        <Card title="Demo toggles">
          <div className="apgms-muted" style={{ marginBottom: 10 }}>
            These are placeholders for your emotional safety toggles, risk thresholds, and policy override workflow.
          </div>
          <table className="apgms-table">
            <tbody>
              <tr><td style={{ fontWeight: 800 }}>Auto-sweep cadence</td><td className="apgms-muted">Weekly (mock)</td></tr>
              <tr><td style={{ fontWeight: 800 }}>Shortfall alerts</td><td className="apgms-muted">Enabled (mock)</td></tr>
              <tr><td style={{ fontWeight: 800 }}>Evidence retention</td><td className="apgms-muted">7 years (mock)</td></tr>
              <tr><td style={{ fontWeight: 800 }}>Regulator portal</td><td className="apgms-muted">Read-only export (mock)</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
