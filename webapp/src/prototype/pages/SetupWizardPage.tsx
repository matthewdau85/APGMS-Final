import React, { useMemo, useState } from "react";
import { usePrototype } from "../store";

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

function StepTitle(props: { step: StepId }) {
  const map: Record<number, string> = {
    1: "Organization",
    2: "Reporting & obligations",
    3: "Accounts mapping",
    4: "Integrations (mocked)",
    5: "Notifications & security",
    6: "Finish",
  };
  return <div className="apgms-proto__pill">{map[props.step]}</div>;
}

export default function SetupWizardPage() {
  const { state, updateSettings } = usePrototype();
  const s = state.settings;

  const [step, setStep] = useState<StepId>(1);

  const [orgName, setOrgName] = useState(s.orgName);
  const [abn, setAbn] = useState(s.abn);
  const [tz, setTz] = useState(s.timeZone);

  const [cadence, setCadence] = useState(s.reportingCadence);
  const [defaultPeriod, setDefaultPeriod] = useState(s.defaultPeriod);

  const [operating, setOperating] = useState(s.accounts.operatingLabel);
  const [taxBuffer, setTaxBuffer] = useState(s.accounts.taxBufferLabel);
  const [trust, setTrust] = useState(s.accounts.trustLabel);

  const [bankProvider, setBankProvider] = useState(s.integrations.bankFeed.provider);
  const [acctProvider, setAcctProvider] = useState(s.integrations.accounting.provider);
  const [payrollProvider, setPayrollProvider] = useState(s.integrations.payroll.provider);

  const [emailEnabled, setEmailEnabled] = useState(s.notifications.emailEnabled);
  const [webhookEnabled, setWebhookEnabled] = useState(s.notifications.webhookEnabled);
  const [webhookUrl, setWebhookUrl] = useState(s.notifications.webhookUrl);

  const [requireMfa, setRequireMfa] = useState(s.security.requireMfaForAdmin);

  const canNext = useMemo(() => {
    if (step === 1) return orgName.trim().length >= 2 && abn.trim().length >= 2 && tz.trim().length >= 2;
    if (step === 2) return cadence === "Quarterly" || cadence === "Monthly";
    if (step === 3) return operating.trim().length >= 2 && taxBuffer.trim().length >= 2 && trust.trim().length >= 2;
    if (step === 4) return bankProvider.trim().length >= 2 && acctProvider.trim().length >= 2 && payrollProvider.trim().length >= 2;
    if (step === 5) return !webhookEnabled || webhookUrl.trim().length >= 5;
    return true;
  }, [step, orgName, abn, tz, cadence, operating, taxBuffer, trust, bankProvider, acctProvider, payrollProvider, webhookEnabled, webhookUrl]);

  function next() {
    setStep((prev) => (Math.min(6, prev + 1) as StepId));
  }
  function back() {
    setStep((prev) => (Math.max(1, prev - 1) as StepId));
  }

  function finish() {
    updateSettings({
      wizardCompleted: true,
      orgName: orgName.trim(),
      abn: abn.trim(),
      timeZone: tz.trim(),
      reportingCadence: cadence,
      defaultPeriod,
      accounts: { operatingLabel: operating.trim(), taxBufferLabel: taxBuffer.trim(), trustLabel: trust.trim() },
      integrations: {
        bankFeed: { status: "Connected (mock)", provider: bankProvider.trim() },
        accounting: { status: "Connected (mock)", provider: acctProvider.trim() },
        payroll: { status: "Connected (mock)", provider: payrollProvider.trim() },
      },
      notifications: { emailEnabled, webhookEnabled, webhookUrl: webhookUrl.trim() },
      security: { ...s.security, requireMfaForAdmin: requireMfa },
    });
  }

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Setup Wizard (Demo)</h3>
            <div className="apgms-proto__muted">Configure APGMS for a mock organization with mocked connections.</div>
          </div>
          <StepTitle step={step} />
        </div>
      </div>

      <div className="apgms-proto__card">
        {step === 1 ? (
          <>
            <h3 style={{ marginTop: 0 }}>Organization</h3>
            <div className="apgms-proto__muted">These values shape the UI and evidence pack metadata (demo).</div>

            <div className="apgms-proto__field">
              <label>Organization name</label>
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
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h3 style={{ marginTop: 0 }}>Reporting & obligations</h3>
            <div className="apgms-proto__muted">Controls how obligations are grouped and due windows are displayed (demo).</div>

            <div className="apgms-proto__field">
              <label>Reporting cadence</label>
              <select className="apgms-proto__select" value={cadence} onChange={(e) => setCadence(e.target.value as any)}>
                <option value="Quarterly">Quarterly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div className="apgms-proto__field">
              <label>Default period</label>
              <select className="apgms-proto__select" value={defaultPeriod} onChange={(e) => setDefaultPeriod(e.target.value as any)}>
                <option value="2025-Q1">2025-Q1</option>
                <option value="2025-Q2">2025-Q2</option>
                <option value="2025-Q3">2025-Q3</option>
                <option value="2025-Q4">2025-Q4</option>
              </select>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h3 style={{ marginTop: 0 }}>Accounts mapping</h3>
            <div className="apgms-proto__muted">Production design intent: segregated flows + clear labels.</div>

            <div className="apgms-proto__field">
              <label>Operating account label</label>
              <input className="apgms-proto__input" value={operating} onChange={(e) => setOperating(e.target.value)} />
            </div>

            <div className="apgms-proto__field">
              <label>Tax buffer account label</label>
              <input className="apgms-proto__input" value={taxBuffer} onChange={(e) => setTaxBuffer(e.target.value)} />
            </div>

            <div className="apgms-proto__field">
              <label>Segregated / trust label</label>
              <input className="apgms-proto__input" value={trust} onChange={(e) => setTrust(e.target.value)} />
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h3 style={{ marginTop: 0 }}>Integrations (mocked)</h3>
            <div className="apgms-proto__muted">These are fully mocked connections to make the console feel deployable.</div>

            <div className="apgms-proto__field">
              <label>Bank feed provider</label>
              <input className="apgms-proto__input" value={bankProvider} onChange={(e) => setBankProvider(e.target.value)} />
            </div>

            <div className="apgms-proto__field">
              <label>Accounting provider</label>
              <input className="apgms-proto__input" value={acctProvider} onChange={(e) => setAcctProvider(e.target.value)} />
            </div>

            <div className="apgms-proto__field">
              <label>Payroll provider</label>
              <input className="apgms-proto__input" value={payrollProvider} onChange={(e) => setPayrollProvider(e.target.value)} />
            </div>

            <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
              When you finish, these will show as “Connected (mock)” in Settings.
            </div>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h3 style={{ marginTop: 0 }}>Notifications & security</h3>
            <div className="apgms-proto__muted">Production intent: explicit security posture + auditability.</div>

            <div className="apgms-proto__field">
              <label>
                <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} /> Enable email notifications (demo)
              </label>
            </div>

            <div className="apgms-proto__field">
              <label>
                <input type="checkbox" checked={webhookEnabled} onChange={(e) => setWebhookEnabled(e.target.checked)} /> Enable webhook notifications (demo)
              </label>
              {webhookEnabled ? (
                <input className="apgms-proto__input" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" />
              ) : null}
            </div>

            <div className="apgms-proto__field">
              <label>
                <input type="checkbox" checked={requireMfa} onChange={(e) => setRequireMfa(e.target.checked)} /> Require MFA for admin actions (demo policy)
              </label>
            </div>
          </>
        ) : null}

        {step === 6 ? (
          <>
            <h3 style={{ marginTop: 0 }}>Finish</h3>
            <div className="apgms-proto__muted">
              This completes setup and unlocks the console navigation. You can rerun setup later from Settings.
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              <div className="apgms-proto__muted"><strong>Org:</strong> {orgName}</div>
              <div className="apgms-proto__muted"><strong>ABN:</strong> {abn}</div>
              <div className="apgms-proto__muted"><strong>Cadence:</strong> {cadence}</div>
              <div className="apgms-proto__muted"><strong>Integrations:</strong> {bankProvider}, {acctProvider}, {payrollProvider}</div>
            </div>
          </>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="apgms-proto__btn secondary" onClick={back} disabled={step === 1}>
            Back
          </button>

          {step < 6 ? (
            <button className="apgms-proto__btn" onClick={next} disabled={!canNext}>
              Continue
            </button>
          ) : (
            <button className="apgms-proto__btn" onClick={finish}>
              Finish setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
