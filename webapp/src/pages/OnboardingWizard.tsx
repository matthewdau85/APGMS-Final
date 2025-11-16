// webapp/src/pages/OnboardingWizard.tsx
// Multi-step onboarding wizard for APGMS
// - Step 1: ABN/TFN validation
// - Step 2: Bank provider + schedules + account details
// - Step 3: Summary and submit

import React, { useState } from "react";

type Obligation = "PAYGW" | "GST" | "PAYGI";

type Schedule = "TRANSACTION" | "DAILY" | "WEEKLY";

interface ValidateResponse {
  obligations: Obligation[];
}

interface SetupPayload {
  abn: string;
  tfn: string;
  bankProvider: string;
  schedule: Schedule;
  accounts: {
    paygw?: string;
    gst?: string;
    paygi?: string;
  };
}

const bankProviders = [
  { value: "cba", label: "Commonwealth Bank" },
  { value: "nab", label: "NAB" },
  { value: "anz", label: "ANZ" },
];

const schedules: { value: Schedule; label: string }[] = [
  { value: "TRANSACTION", label: "Per transaction" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
];

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [abn, setAbn] = useState("");
  const [tfn, setTfn] = useState("");
  const [obligations, setObligations] = useState<Obligation[]>([]);

  const [bankProvider, setBankProvider] = useState("cba");
  const [schedule, setSchedule] = useState<Schedule>("DAILY");
  const [paygwAccount, setPaygwAccount] = useState("");
  const [gstAccount, setGstAccount] = useState("");
  const [paygiAccount, setPaygiAccount] = useState("");

  const [completed, setCompleted] = useState(false);

  async function handleValidateAbnTfn() {
    setError(null);
    if (!abn.trim() || !tfn.trim()) {
      setError("ABN and TFN are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/onboarding/validate?abn=${encodeURIComponent(abn)}&tfn=${encodeURIComponent(tfn)}`,
        {
          method: "GET",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to validate ABN/TFN");
      }
      const data: ValidateResponse = await res.json();
      setObligations(data.obligations);
      setStep(1);
    } catch (err: any) {
      setError(err.message || "Unexpected error validating ABN/TFN");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitSetup() {
    setError(null);
    setLoading(true);
    try {
      const payload: SetupPayload = {
        abn,
        tfn,
        bankProvider,
        schedule,
        accounts: {},
      };
      if (obligations.includes("PAYGW")) payload.accounts.paygw = paygwAccount;
      if (obligations.includes("GST")) payload.accounts.gst = gstAccount;
      if (obligations.includes("PAYGI")) payload.accounts.paygi = paygiAccount;

      const res = await fetch("/onboarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to complete onboarding");
      }
      setCompleted(true);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Unexpected error during setup");
    } finally {
      setLoading(false);
    }
  }

  function renderStep() {
    if (completed && step === 2) {
      return (
        <div>
          <h2>Onboarding complete</h2>
          <p>Your designated accounts and PayTo mandates have been configured.</p>
          <p>You can now proceed to the main dashboard.</p>
        </div>
      );
    }

    if (step === 0) {
      return (
        <div>
          <h2>Step 1: Verify ABN and TFN</h2>
          <label>
            ABN
            <input
              type="text"
              value={abn}
              onChange={(e) => setAbn(e.target.value)}
              placeholder="Enter ABN"
            />
          </label>
          <br />
          <label>
            TFN
            <input
              type="password"
              value={tfn}
              onChange={(e) => setTfn(e.target.value)}
              placeholder="Enter TFN"
            />
          </label>
          <br />
          <button disabled={loading} onClick={handleValidateAbnTfn}>
            {loading ? "Validating..." : "Next"}
          </button>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div>
          <h2>Step 2: Configure Banking and Schedules</h2>
          <div>
            <label>
              Bank provider
              <select value={bankProvider} onChange={(e) => setBankProvider(e.target.value)}>
                {bankProviders.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Securing schedule
              <select value={schedule} onChange={(e) => setSchedule(e.target.value as Schedule)}>
                {schedules.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            {obligations.includes("PAYGW") && (
              <label>
                PAYGW account identifier
                <input
                  type="text"
                  value={paygwAccount}
                  onChange={(e) => setPaygwAccount(e.target.value)}
                  placeholder="BSB/Account or provider identifier"
                />
              </label>
            )}
          </div>
          <div>
            {obligations.includes("GST") && (
              <label>
                GST account identifier
                <input
                  type="text"
                  value={gstAccount}
                  onChange={(e) => setGstAccount(e.target.value)}
                  placeholder="BSB/Account or provider identifier"
                />
              </label>
            )}
          </div>
          <div>
            {obligations.includes("PAYGI") && (
              <label>
                PAYGI account identifier
                <input
                  type="text"
                  value={paygiAccount}
                  onChange={(e) => setPaygiAccount(e.target.value)}
                  placeholder="BSB/Account or provider identifier"
                />
              </label>
            )}
          </div>
          <br />
          <button disabled={loading} onClick={() => setStep(0)}>
            Back
          </button>{" "}
          <button disabled={loading} onClick={handleSubmitSetup}>
            {loading ? "Saving..." : "Complete onboarding"}
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <h1>APGMS Onboarding</h1>
      {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}
      {renderStep()}
    </div>
  );
}
