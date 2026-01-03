import React, { useState } from "react";
import { useDemoStore } from "../store";

function Section(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
      <div style={{ fontWeight: 900 }}>{props.title}</div>
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6, lineHeight: 1.35 }}>{props.subtitle}</div>
      <div style={{ marginTop: 10 }}>{props.children}</div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{props.label}</div>
      <div style={{ marginTop: 6 }}>{props.children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, resetDemoState } = useDemoStore();

  const [seed, setSeed] = useState(settings.simulation.seed);
  const [interval, setInterval] = useState(String(settings.simulation.feedIntervalSeconds));

  const saveSimulation = () => {
    const seconds = Math.max(10, Math.min(600, parseInt(interval, 10) || settings.simulation.feedIntervalSeconds));
    updateSettings({ simulation: { ...settings.simulation, seed: seed.trim() || settings.simulation.seed, feedIntervalSeconds: seconds } });
  };

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Settings</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Deployable configuration surface. Values are demo-only but structured to match a production-grade settings model."}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))", gap: 12 }}>
        <Section title="Organization" subtitle="Name, ABN, time zone, and reporting calendar.">
          <Field label="Organization name">
            <input
              className="apgms-proto__input"
              value={settings.organization.name}
              onChange={(e) => updateSettings({ organization: { ...settings.organization, name: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="ABN (demo)">
            <input
              className="apgms-proto__input"
              value={settings.organization.abn}
              onChange={(e) => updateSettings({ organization: { ...settings.organization, abn: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Time zone">
            <input
              className="apgms-proto__input"
              value={settings.organization.timeZone}
              onChange={(e) => updateSettings({ organization: { ...settings.organization, timeZone: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
        </Section>

        <Section title="Period & obligations" subtitle="Cadence, due date rules, and reminders.">
          <Field label="Cadence">
            <select
              className="apgms-proto__input"
              value={settings.periods.cadence}
              onChange={(e) => updateSettings({ periods: { ...settings.periods, cadence: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </Field>
          <Field label="Reminder days before due">
            <input
              className="apgms-proto__input"
              value={String(settings.periods.reminderDaysBeforeDue)}
              onChange={(e) => updateSettings({ periods: { ...settings.periods, reminderDaysBeforeDue: parseInt(e.target.value, 10) || 14 } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
        </Section>

        <Section title="Accounts" subtitle="Operating, tax buffer, and segregated account mapping.">
          <Field label="Operating account label">
            <input
              className="apgms-proto__input"
              value={settings.accounts.operatingAccountLabel}
              onChange={(e) => updateSettings({ accounts: { ...settings.accounts, operatingAccountLabel: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Tax buffer account label">
            <input
              className="apgms-proto__input"
              value={settings.accounts.taxBufferAccountLabel}
              onChange={(e) => updateSettings({ accounts: { ...settings.accounts, taxBufferAccountLabel: e.target.value } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Segregated account enabled">
            <select
              className="apgms-proto__input"
              value={settings.accounts.segregatedAccountEnabled ? "yes" : "no"}
              onChange={(e) => updateSettings({ accounts: { ...settings.accounts, segregatedAccountEnabled: e.target.value === "yes" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="yes">Yes (recommended)</option>
              <option value="no">No</option>
            </select>
          </Field>
        </Section>

        <Section title="Integrations" subtitle="Bank feed, accounting, payroll (demo states).">
          <Field label="Bank feed">
            <select
              className="apgms-proto__input"
              value={settings.integrations.bankFeed}
              onChange={(e) => updateSettings({ integrations: { ...settings.integrations, bankFeed: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="connected_demo">Connected (demo)</option>
              <option value="not_connected">Not connected</option>
            </select>
          </Field>
          <Field label="Accounting">
            <select
              className="apgms-proto__input"
              value={settings.integrations.accounting}
              onChange={(e) => updateSettings({ integrations: { ...settings.integrations, accounting: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="not_connected">Not connected</option>
              <option value="connected_demo">Connected (demo)</option>
            </select>
          </Field>
          <Field label="Payroll">
            <select
              className="apgms-proto__input"
              value={settings.integrations.payroll}
              onChange={(e) => updateSettings({ integrations: { ...settings.integrations, payroll: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="not_connected">Not connected</option>
              <option value="connected_demo">Connected (demo)</option>
            </select>
          </Field>
        </Section>

        <Section title="Notifications" subtitle="Email/webhook toggles (demo).">
          <Field label="Email notifications">
            <select
              className="apgms-proto__input"
              value={settings.notifications.emailEnabled ? "on" : "off"}
              onChange={(e) => updateSettings({ notifications: { ...settings.notifications, emailEnabled: e.target.value === "on" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </Field>
          <Field label="Webhook notifications">
            <select
              className="apgms-proto__input"
              value={settings.notifications.webhookEnabled ? "on" : "off"}
              onChange={(e) => updateSettings({ notifications: { ...settings.notifications, webhookEnabled: e.target.value === "on" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="off">Disabled</option>
              <option value="on">Enabled</option>
            </select>
          </Field>
        </Section>

        <Section title="Security" subtitle="MFA policy, session timeout, and admin roles (demo).">
          <Field label="MFA required for admin">
            <select
              className="apgms-proto__input"
              value={settings.security.mfaRequiredForAdmin ? "yes" : "no"}
              onChange={(e) => updateSettings({ security: { ...settings.security, mfaRequiredForAdmin: e.target.value === "yes" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Session timeout (minutes)">
            <input
              className="apgms-proto__input"
              value={String(settings.security.sessionTimeoutMinutes)}
              onChange={(e) => updateSettings({ security: { ...settings.security, sessionTimeoutMinutes: parseInt(e.target.value, 10) || 30 } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
        </Section>

        <Section title="Data retention" subtitle="Event/log retention windows (demo).">
          <Field label="Event retention (days)">
            <input
              className="apgms-proto__input"
              value={String(settings.retention.eventRetentionDays)}
              onChange={(e) => updateSettings({ retention: { ...settings.retention, eventRetentionDays: parseInt(e.target.value, 10) || 365 } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Evidence pack retention (days)">
            <input
              className="apgms-proto__input"
              value={String(settings.retention.evidencePackRetentionDays)}
              onChange={(e) => updateSettings({ retention: { ...settings.retention, evidencePackRetentionDays: parseInt(e.target.value, 10) || 3650 } } as any)}
              style={{ width: "100%" }}
            />
          </Field>
        </Section>

        <Section title="Export" subtitle="Evidence pack defaults and regulator portal settings (demo).">
          <Field label="Default evidence pack scope">
            <select
              className="apgms-proto__input"
              value={settings.export.defaultEvidencePackScope}
              onChange={(e) => updateSettings({ export: { ...settings.export, defaultEvidencePackScope: e.target.value as any } } as any)}
              style={{ width: "100%" }}
            >
              <option value="obligation">Obligation</option>
              <option value="period">Period</option>
            </select>
          </Field>
          <Field label="Regulator portal enabled">
            <select
              className="apgms-proto__input"
              value={settings.export.regulatorPortalEnabled ? "on" : "off"}
              onChange={(e) => updateSettings({ export: { ...settings.export, regulatorPortalEnabled: e.target.value === "on" } } as any)}
              style={{ width: "100%" }}
            >
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </Field>
        </Section>

        <Section title="Simulation" subtitle="Deterministic incoming feed events (default interval is less frequent).">
          <Field label="Seed (deterministic)">
            <input className="apgms-proto__input" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: "100%" }} />
          </Field>
          <Field label="Feed interval (seconds)">
            <input className="apgms-proto__input" value={interval} onChange={(e) => setInterval(e.target.value)} style={{ width: "100%" }} />
          </Field>
          <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={saveSimulation}>Save simulation settings</button>
        </Section>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="apgms-proto__btn" onClick={resetDemoState}>Reset demo state</button>
        <div className="apgms-proto__muted" style={{ alignSelf: "center" }}>
          {"Reset clears local demo state so the runbook steps behave the same each time."}
        </div>
      </div>
    </div>
  );
}
