import React, { useState } from "react";

type TaxObligationType = "GST" | "PAYGW" | "PAYGI";

type ValidateResponse = {
  abn?: string;
  tfn?: string;
  legalName: string;
  obligations: TaxObligationType[];
};

type SetupPayload = {
  abn: string;
  legalName: string;
  schedule: "MONTHLY" | "QUARTERLY";
  shortfallThresholdBps: number;
  bankCode: "cba" | "nab" | "anz";
  account: {
    bsb: string;
    accountNumber: string;
    accountName: string;
  };
  obligations: TaxObligationType[];
};

type Step = 0 | 1 | 2 | 3;

// Assume dev proxy /api → Fastify
const API_BASE = "/api";

export const OnboardingWizard: React.FC = () => {
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [abn, setAbn] = useState("");
  const [tfn, setTfn] = useState("");
  const [validateResult, setValidateResult] = useState<ValidateResponse | null>(
    null,
  );

  const [schedule, setSchedule] = useState<"MONTHLY" | "QUARTERLY">(
    "QUARTERLY",
  );
  const [shortfallBps, setShortfallBps] = useState(500);

  const [bankCode, setBankCode] = useState<"cba" | "nab" | "anz">("cba");
  const [bsb, setBsb] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [selectedObligations, setSelectedObligations] = useState<
    TaxObligationType[]
  >([]);

  const toggleObligation = (code: TaxObligationType) => {
    setSelectedObligations((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );
  };

  const callApi = async (path: string, options: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      credentials: "include",
    });

    if (!res.ok) {
      let msg = `Request failed with ${res.status}`;
      try {
        const body = await res.json();
        msg = body?.error?.message ?? msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    return res.json();
  };

  const handleValidate = async () => {
    setError(null);
    setLoading(true);
    try {
      const body: { abn?: string; tfn?: string } = {};
      if (abn) body.abn = abn;
      if (tfn) body.tfn = tfn;

      const result: ValidateResponse = await callApi(
        "/onboarding/validate",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      setValidateResult(result);
      setSelectedObligations(result.obligations);
      setStep(1);
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    if (!validateResult?.abn) {
      setError("ABN must be validated first");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload: SetupPayload = {
        abn: validateResult.abn,
        legalName: validateResult.legalName,
        schedule,
        shortfallThresholdBps: shortfallBps,
        bankCode,
        account: {
          bsb,
          accountNumber,
          accountName: accountName || validateResult.legalName,
        },
        obligations: selectedObligations,
      };
      const res = await callApi("/onboarding/setup", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // store orgId for routing logic
      if (res?.orgId) {
        window.localStorage.setItem("apgms_org_id", res.orgId);
      }

      setStep(3);
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const canContinueFromStep1 =
    !!validateResult &&
    !!bsb &&
    !!accountNumber &&
    selectedObligations.length > 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          APGMS Onboarding – Tax Buffer Setup
        </h1>
        <p className="text-sm text-slate-600">
          We&apos;ll validate your ABN/TFN, detect obligations, and configure
          secure PayTo mandates to your tax buffer.
        </p>
      </header>

      <div className="flex items-center space-x-2 text-xs text-slate-600">
        <span className={step === 0 ? "font-semibold" : ""}>1. ABN / TFN</span>
        <span>›</span>
        <span className={step === 1 ? "font-semibold" : ""}>
          2. Bank &amp; Schedule
        </span>
        <span>›</span>
        <span className={step === 2 ? "font-semibold" : ""}>
          3. Confirm &amp; Create
        </span>
        <span>›</span>
        <span className={step === 3 ? "font-semibold" : ""}>4. Done</span>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {step === 0 && (
        <section className="space-y-4 border rounded-lg p-4">
          <h2 className="text-lg font-medium">Step 1 – ABN / TFN</h2>
          <p className="text-sm text-slate-600">
            Enter your ABN or TFN so we can look up your registration and
            obligations.
          </p>
          <div className="space-y-3">
            <label className="block text-sm">
              ABN
              <input
                className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                placeholder="11-digit ABN"
              />
            </label>
            <label className="block text-sm">
              TFN (optional)
              <input
                className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
                value={tfn}
                onChange={(e) => setTfn(e.target.value)}
                placeholder="TFN if applicable"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleValidate}
              disabled={loading || (!abn && !tfn)}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
            >
              {loading ? "Validating…" : "Validate"}
            </button>
          </div>
        </section>
      )}

      {step === 1 && validateResult && (
        <section className="space-y-4 border rounded-lg p-4">
          <h2 className="text-lg font-medium">
            Step 2 – Bank, Schedule &amp; Obligations
          </h2>

          <div className="space-y-2 text-sm">
            <div>
              <div className="font-semibold">Entity</div>
              <div>{validateResult.legalName}</div>
              <div className="text-slate-600">
                ABN: {validateResult.abn ?? "—"} | TFN:{" "}
                {validateResult.tfn ?? "—"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <label className="block">
                Payment frequency
                <select
                  className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
                  value={schedule}
                  onChange={(e) =>
                    setSchedule(e.target.value as "MONTHLY" | "QUARTERLY")
                  }
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly (BAS)</option>
                </select>
              </label>

              <label className="block">
                Shortfall threshold (%)
                <input
                  type="number"
                  className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
                  value={shortfallBps / 100}
                  min={0}
                  max={100}
                  onChange={(e) =>
                    setShortfallBps(Math.round(Number(e.target.value) * 100))
                  }
                />
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Obligations to secure
                </legend>
                {(["GST", "PAYGW", "PAYGI"] as TaxObligationType[]).map(
                  (code) => {
                    const detected = validateResult.obligations.includes(code);
                    const checked = selectedObligations.includes(code);
                    return (
                      <label key={code} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!detected}
                          onChange={() => toggleObligation(code)}
                        />
                        <span>
                          {code}{" "}
                          {!detected && (
                            <span className="text-xs text-slate-500">
                              (not detected on registration)
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  },
                )}
              </fieldset>
            </div>

            <div className="space-y-2">
              <label className="block">
                Bank
                <select
                  className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
                  value={bankCode}
                  onChange={(e) =>
                    setBankCode(e.target.value as "cba" | "nab" | "anz")
                  }
                >
                  <option value="cba">CBA</option>
                  <option value="nab">NAB</option>
                  <option value="anz">ANZ</option>
                </select>
              </label>

              <label className="block">
                BSB
                <input
                  className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
                  value={bsb}
                  onChange={(e) => setBsb(e.target.value)}
                  placeholder="e.g. 062-000"
                />
              </label>

              <label className="block">
                Account number
                <input
                  className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 12345678"
                />
              </label>

              <label className="block">
                Account name (optional)
                <input
                  className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={validateResult.legalName}
                />
              </label>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setStep(0)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={loading || !canContinueFromStep1}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
              onClick={() => setStep(2)}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 2 && validateResult && (
        <section className="space-y-4 border rounded-lg p-4">
          <h2 className="text-lg font-medium">Step 3 – Confirm</h2>
          <p className="text-sm text-slate-600">
            Review your settings. When you continue, APGMS will initiate a
            PayTo mandate and create designated tax buffer accounts.
          </p>

          <div className="space-y-2 text-sm">
            <div>
              <div className="font-semibold">Entity</div>
              <div>{validateResult.legalName}</div>
              <div className="text-slate-600">
                ABN: {validateResult.abn ?? "—"}
              </div>
            </div>

            <div>
              <div className="font-semibold">Schedule</div>
              <div>{schedule}</div>
            </div>

            <div>
              <div className="font-semibold">Shortfall threshold</div>
              <div>{(shortfallBps / 100).toFixed(2)}%</div>
            </div>

            <div>
              <div className="font-semibold">Obligations</div>
              <div>{selectedObligations.join(", ") || "None"}</div>
            </div>

            <div>
              <div className="font-semibold">Bank account</div>
              <div>
                {bsb} / {accountNumber}
              </div>
              <div className="text-slate-600">
                {accountName || validateResult.legalName}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={loading}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
              onClick={handleSetup}
            >
              {loading ? "Creating…" : "Create mandates & accounts"}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="text-lg font-medium">All done</h2>
          <p className="text-sm text-slate-600">
            Your organisation is onboarded. APGMS will now start tracking
            buffer coverage versus your obligations. You can review this in the
            dashboard.
          </p>
          <div>
            <button
              type="button"
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium"
              onClick={() => {
                window.location.href = "/dashboard";
              }}
            >
              Go to dashboard
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
