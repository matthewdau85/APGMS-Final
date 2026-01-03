import React, { useMemo, useState } from "react";
import { usePrototype } from "../store";
import { getAnalyticsEvents, resetAnalytics } from "../analytics";

export default function SettingsPage() {
  const { state, updateSettings, toggleSimulation, setSimulationIntervalMs, resetDemo } = usePrototype();
  const s = state.settings;

  const [orgName, setOrgName] = useState(s.orgName);
  const [abn, setAbn] = useState(s.abn);
  const [tz, setTz] = useState(s.timeZone);

  const [webhookUrl, setWebhookUrl] = useState(s.notifications.webhookUrl);

  const analyticsEvents = useMemo(() => getAnalyticsEvents().slice(0, 20), []);

  function saveOrg() {
    updateSettings({ orgName: orgName.trim(), abn: abn.trim(), timeZone: tz.trim() });
  }

  function saveWebhook() {
    updateSettings({ notifications: { ...s.notifications, webhookUrl: webhookUrl.trim() } });
  }

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <div className="apgms-proto__muted">
          Production intent: deployable per organization while staying compliant and auditable.
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Organization</h3>

        <div className="apgms-proto__field">
          <label>Name</label>
          <input className="apgms-proto__input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>

        <div className="apgms-proto__field">
          <label>ABN (demo)</label>
          <input className="apgms-proto__input" value={abn} onChange={(e) => setAbn(e.target.value)} />
        </div>

        <div className="apgms-proto__field">
          <label>Time zone</label>
          <input className="apgms-proto__input" value={tz} onChange={(e) => setTz(e.target.value)} />
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="apgms-proto__btn" onClick={saveOrg}>Save</button>
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Period & obligations</h3>
        <div className="apgms-proto__muted">Cadence and period defaults are configured via Setup Wizard (demo).</div>
        <div style={{ marginTop: 10 }} className="apgms-proto__muted">
          <strong>Cadence:</strong> {s.reportingCadence} <br />
          <strong>Default period:</strong> {s.defaultPeriod}
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Accounts</h3>
        <div className="apgms-proto__muted">Mapping surfaces for operating, tax buffer, and segregated account labels.</div>
        <div style={{ marginTop: 10 }} className="apgms-proto__muted">
          <strong>Operating:</strong> {s.accounts.operatingLabel}<br />
          <strong>Tax buffer:</strong> {s.accounts.taxBufferLabel}<br />
          <strong>Segregated:</strong> {s.accounts.trustLabel}
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Integrations</h3>
        <table className="apgms-proto__table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Status</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bank feed</td>
              <td className="apgms-proto__muted">{s.integrations.bankFeed.status}</td>
              <td className="apgms-proto__muted">{s.integrations.bankFeed.provider}</td>
            </tr>
            <tr>
              <td>Accounting</td>
              <td className="apgms-proto__muted">{s.integrations.accounting.status}</td>
              <td className="apgms-proto__muted">{s.integrations.accounting.provider}</td>
            </tr>
            <tr>
              <td>Payroll</td>
              <td className="apgms-proto__muted">{s.integrations.payroll.status}</td>
              <td className="apgms-proto__muted">{s.integrations.payroll.provider}</td>
            </tr>
          </tbody>
        </table>

        <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
          Use Setup Wizard to reconfigure mocked connections.
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Notifications</h3>

        <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={s.notifications.emailEnabled}
            onChange={(e) => updateSettings({ notifications: { ...s.notifications, emailEnabled: e.target.checked } })}
          />
          Email notifications (demo)
        </label>

        <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={s.notifications.webhookEnabled}
            onChange={(e) => updateSettings({ notifications: { ...s.notifications, webhookEnabled: e.target.checked } })}
          />
          Webhook notifications (demo)
        </label>

        {s.notifications.webhookEnabled ? (
          <div className="apgms-proto__field">
            <label>Webhook URL</label>
            <input className="apgms-proto__input" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" />
            <div style={{ marginTop: 10 }}>
              <button className="apgms-proto__btn" onClick={saveWebhook}>Save</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Security</h3>
        <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={s.security.requireMfaForAdmin}
            onChange={(e) => updateSettings({ security: { ...s.security, requireMfaForAdmin: e.target.checked } })}
          />
          Require MFA for admin actions (demo policy)
        </label>

        <div className="apgms-proto__field">
          <label>Session timeout (minutes)</label>
          <input
            className="apgms-proto__input"
            type="number"
            value={s.security.sessionTimeoutMinutes}
            onChange={(e) => updateSettings({ security: { ...s.security, sessionTimeoutMinutes: Number(e.target.value || 0) } })}
          />
        </div>

        <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={s.security.allowRegulatorPortal}
            onChange={(e) => updateSettings({ security: { ...s.security, allowRegulatorPortal: e.target.checked } })}
          />
          Enable Regulator Portal read-only views (demo)
        </label>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Data retention</h3>
        <div className="apgms-proto__field">
          <label>Event/log retention (days)</label>
          <input
            className="apgms-proto__input"
            type="number"
            value={s.retention.eventRetentionDays}
            onChange={(e) => updateSettings({ retention: { ...s.retention, eventRetentionDays: Number(e.target.value || 0) } })}
          />
        </div>
        <div className="apgms-proto__field">
          <label>Evidence pack retention (days)</label>
          <input
            className="apgms-proto__input"
            type="number"
            value={s.retention.evidenceRetentionDays}
            onChange={(e) => updateSettings({ retention: { ...s.retention, evidenceRetentionDays: Number(e.target.value || 0) } })}
          />
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Export defaults</h3>
        <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={s.exportDefaults.includeTimeline}
            onChange={(e) => updateSettings({ exportDefaults: { ...s.exportDefaults, includeTimeline: e.target.checked } })}
          />
          Include timeline in evidence packs
        </label>
        <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={s.exportDefaults.includePayloadSnapshots}
            onChange={(e) => updateSettings({ exportDefaults: { ...s.exportDefaults, includePayloadSnapshots: e.target.checked } })}
          />
          Include payload snapshots (demo)
        </label>
        <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={s.exportDefaults.includeControlAttestation}
            onChange={(e) => updateSettings({ exportDefaults: { ...s.exportDefaults, includeControlAttestation: e.target.checked } })}
          />
          Include controls attestation (demo)
        </label>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Analytics</h3>
        <label className="apgms-proto__muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={s.analytics.enabled}
            onChange={(e) => updateSettings({ analytics: { ...s.analytics, enabled: e.target.checked } })}
          />
          Enable analytics (demo)
        </label>

        <div className="apgms-proto__field">
          <label>Provider</label>
          <select
            className="apgms-proto__select"
            value={s.analytics.provider}
            onChange={(e) => updateSettings({ analytics: { ...s.analytics, provider: e.target.value as any } })}
          >
            <option value="Demo (local)">Demo (local)</option>
            <option value="PostHog (planned)">PostHog (planned)</option>
            <option value="GA4 (planned)">GA4 (planned)</option>
          </select>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="apgms-proto__btn secondary" onClick={() => { resetAnalytics(); window.location.reload(); }}>
            Clear analytics (demo)
          </button>
        </div>

        <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
          Recent events (demo):
          <ul style={{ marginTop: 6 }}>
            {analyticsEvents.map((e) => (
              <li key={e.id}>{new Date(e.ts).toLocaleString("en-AU")} - {e.name}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Simulation</h3>
        <div className="apgms-proto__muted">Incoming feeds are intentionally less frequent by default.</div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="apgms-proto__btn" onClick={() => toggleSimulation(!s.simulation.enabled)}>
            Simulation: {s.simulation.enabled ? "ON" : "OFF"}
          </button>

          <div className="apgms-proto__muted">Cadence:</div>
          <select
            className="apgms-proto__select"
            value={s.simulation.intervalMs}
            onChange={(e) => setSimulationIntervalMs(Number(e.target.value))}
          >
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
            <option value={120000}>120s</option>
            <option value={300000}>300s</option>
          </select>
        </div>

        <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
          Seed: {String(s.simulation.seed)} (demo deterministic baseline)
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Admin</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button className="apgms-proto__btn secondary" onClick={() => updateSettings({ wizardCompleted: false })}>
            Re-run Setup Wizard
          </button>
          <button className="apgms-proto__btn danger" onClick={resetDemo}>
            Reset demo state
          </button>
        </div>
        <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
          Reset clears prototype store and returns the console to initial demo state.
        </div>
      </div>
    </div>
  );
}
