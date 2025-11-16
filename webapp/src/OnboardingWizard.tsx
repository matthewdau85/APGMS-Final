import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatAbn, isValidAbn, isValidTfn, maskTfn } from "./utils/australianValidators";

const steps = [
  {
    id: "profile",
    label: "Business profile",
    description: "Verify the legal entity so that obligations match the ABN on file.",
    fields: ["abn", "entityName", "tfn"],
  },
  {
    id: "contacts",
    label: "Banking & contacts",
    description: "Capture the account ID and who should receive onboarding notifications.",
    fields: ["accountId", "contactName", "contactEmail"],
  },
  {
    id: "agreements",
    label: "Agreements",
    description: "Confirm acceptance of the Terms, Privacy Policy, and PayTo authority.",
    fields: ["acceptedTerms", "acceptedPrivacy", "acceptedDebit"],
  },
] as const;

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  padding: "32px",
  display: "grid",
  gap: "24px",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  fontSize: "14px",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5f5",
  fontSize: "14px",
};

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: "12px",
};

type WizardState = {
  abn: string;
  entityName: string;
  tfn: string;
  accountId: string;
  contactName: string;
  contactEmail: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedDebit: boolean;
};

const initialState: WizardState = {
  abn: "",
  entityName: "",
  tfn: "",
  accountId: "",
  contactName: "",
  contactEmail: "",
  acceptedTerms: false,
  acceptedPrivacy: false,
  acceptedDebit: false,
};

type DirectDebitAudit = {
  acceptedAt: string;
  contactName: string;
  accountId: string;
};

const consentStorageKey = "apgms.directDebitConsent";
const submissionStorageKey = "apgms.onboardingSubmission";

const accountIdRegex = /^ORG-[A-Z0-9]{4}$/;

const InfoBadge = ({ text }: { text: string }) => (
  <span
    title={text}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: "6px",
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      fontSize: "12px",
      fontWeight: 600,
      color: "#0b5fff",
      border: "1px solid rgba(11, 95, 255, 0.3)",
      cursor: "help",
    }}
  >
    i
  </span>
);

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<WizardState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionTimestamp, setSubmissionTimestamp] = useState<string | null>(null);
  const [directDebitAudit, setDirectDebitAudit] = useState<DirectDebitAudit | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedConsent = window.localStorage.getItem(consentStorageKey);
    if (storedConsent) {
      try {
        setDirectDebitAudit(JSON.parse(storedConsent) as DirectDebitAudit);
      } catch {
        setDirectDebitAudit(null);
      }
    }
    const storedSubmission = window.localStorage.getItem(submissionStorageKey);
    if (storedSubmission) {
      try {
        const parsed = JSON.parse(storedSubmission) as WizardState & { submittedAt: string };
        setForm({
          abn: parsed.abn,
          entityName: parsed.entityName,
          tfn: parsed.tfn,
          accountId: parsed.accountId,
          contactName: parsed.contactName,
          contactEmail: parsed.contactEmail,
          acceptedTerms: parsed.acceptedTerms,
          acceptedPrivacy: parsed.acceptedPrivacy,
          acceptedDebit: parsed.acceptedDebit,
        });
        setSubmissionTimestamp(parsed.submittedAt);
      } catch {
        setSubmissionTimestamp(null);
      }
    }
  }, []);

  const currentStep = steps[stepIndex];
  const completionRatio = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);

  const assignErrors = (fields: readonly string[], newErrors: Record<string, string>) => {
    setErrors((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        delete next[field];
      });
      return { ...next, ...newErrors };
    });
  };

  const validateStep = (step: (typeof steps)[number]): boolean => {
    const fieldErrors: Record<string, string> = {};
    if (step.id === "profile") {
      if (!form.abn) {
        fieldErrors.abn = "ABN is required";
      } else if (!isValidAbn(form.abn)) {
        fieldErrors.abn = "Enter a valid 11 digit ABN";
      }
      if (!form.entityName) {
        fieldErrors.entityName = "Enter the legal entity name";
      }
      if (form.tfn && !isValidTfn(form.tfn)) {
        fieldErrors.tfn = "TFN format looks incorrect";
      }
    }
    if (step.id === "contacts") {
      if (!form.accountId) {
        fieldErrors.accountId = "Account ID is required";
      } else if (!accountIdRegex.test(form.accountId.toUpperCase())) {
        fieldErrors.accountId = "Use pattern ORG-1234 (letters or digits)";
      }
      if (!form.contactName) {
        fieldErrors.contactName = "Provide an authorised contact";
      }
      if (!form.contactEmail) {
        fieldErrors.contactEmail = "Provide an email";
      } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contactEmail)) {
        fieldErrors.contactEmail = "Email looks invalid";
      }
    }
    if (step.id === "agreements") {
      if (!form.acceptedTerms) {
        fieldErrors.acceptedTerms = "You must accept the Terms of Use";
      }
      if (!form.acceptedPrivacy) {
        fieldErrors.acceptedPrivacy = "You must accept the Privacy Policy";
      }
      if (!form.acceptedDebit) {
        fieldErrors.acceptedDebit = "Direct Debit Authority is required for automated remittance";
      }
    }

    assignErrors(step.fields, fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      navigate("/dashboard");
      return;
    }
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = () => {
    if (!validateStep(currentStep)) {
      return;
    }
    const submittedAt = new Date().toISOString();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        submissionStorageKey,
        JSON.stringify({ ...form, submittedAt }),
      );
    }
    setSubmissionTimestamp(submittedAt);
  };

  const updateField = (field: keyof WizardState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field as string]) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  };

  const handleDirectDebitToggle = (checked: boolean) => {
    updateField("acceptedDebit", checked);
    if (checked && typeof window !== "undefined") {
      const record: DirectDebitAudit = {
        acceptedAt: new Date().toISOString(),
        contactName: form.contactName || "Unknown",
        accountId: form.accountId || "Pending",
      };
      window.localStorage.setItem(consentStorageKey, JSON.stringify(record));
      setDirectDebitAudit(record);
    }
  };

  const downloadAgreement = () => {
    if (typeof window === "undefined") return;
    const summary = [
      "APGMS Direct Debit Authority",
      "--------------------------------",
      `Entity: ${form.entityName || "Pending"}`,
      `ABN: ${formatAbn(form.abn) || "Pending"}`,
      `Account ID: ${form.accountId || "Pending"}`,
      `Authorised by: ${form.contactName || "Pending"}`,
      `Email: ${form.contactEmail || "Pending"}`,
      `Accepted: ${new Date().toLocaleString()}`,
    ].join("\n");
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `apgms-direct-debit-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "24px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <header style={{ display: "grid", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Guided onboarding</p>
            <h1 style={{ margin: 0 }}>ATO-ready onboarding wizard</h1>
          </div>
          <progress value={completionRatio} max={100} style={{ width: "180px", height: "8px" }} />
        </div>
        <p style={{ margin: 0, color: "#475467", fontSize: "15px" }}>
          Finish all steps to unlock mandate automation, BAS notifications, and the compliance export bundle. Inline validation
          keeps ABN/TFN errors out of the regulator view.
        </p>
        <ol style={{ display: "flex", gap: "16px", padding: 0, listStyle: "none", margin: 0 }}>
          {steps.map((step, index) => (
            <li
              key={step.id}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "12px",
                border: index === stepIndex ? "2px solid #0b5fff" : "1px solid #e2e8f0",
                background: index <= stepIndex ? "rgba(11, 95, 255, 0.08)" : "#fff",
              }}
            >
              <div style={{ fontSize: "12px", color: "#475467" }}>Step {index + 1}</div>
              <div style={{ fontWeight: 600 }}>{step.label}</div>
              <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#475467" }}>{step.description}</p>
            </li>
          ))}
        </ol>
      </header>

      <section style={cardStyle}>
        {currentStep.id === "profile" && (
          <div style={{ display: "grid", gap: "18px" }}>
            <label style={labelStyle}>
              <span>
                Australian Business Number (ABN)
                <InfoBadge text="11 digits, we run ABR checksum locally before calling the ATO" />
              </span>
              <input
                style={inputStyle}
                value={form.abn}
                onChange={(event) => updateField("abn", event.target.value)}
                placeholder="51 824 753 556"
                inputMode="numeric"
                aria-invalid={Boolean(errors.abn)}
              />
              {errors.abn && <span style={errorStyle}>{errors.abn}</span>}
            </label>

            <label style={labelStyle}>
              <span>
                Legal entity name
                <InfoBadge text="Match ASIC or ATO records to avoid mandate rejections" />
              </span>
              <input
                style={inputStyle}
                value={form.entityName}
                onChange={(event) => updateField("entityName", event.target.value)}
                placeholder="Bluegum Advisory Pty Ltd"
                aria-invalid={Boolean(errors.entityName)}
              />
              {errors.entityName && <span style={errorStyle}>{errors.entityName}</span>}
            </label>

            <label style={labelStyle}>
              <span>
                Tax File Number (TFN)
                <InfoBadge text="Optional but helps us pre-fill STP obligations. We immediately mask it on submit." />
              </span>
              <input
                style={inputStyle}
                value={form.tfn}
                onChange={(event) => updateField("tfn", event.target.value)}
                placeholder="123 456 782"
                inputMode="numeric"
                aria-invalid={Boolean(errors.tfn)}
              />
              {errors.tfn && <span style={errorStyle}>{errors.tfn}</span>}
            </label>
          </div>
        )}

        {currentStep.id === "contacts" && (
          <div style={{ display: "grid", gap: "18px" }}>
            <label style={labelStyle}>
              <span>
                PayTo account ID
                <InfoBadge text="Format ORG-1234. We use it to match mandates and PayTo instructions." />
              </span>
              <input
                style={inputStyle}
                value={form.accountId}
                onChange={(event) => updateField("accountId", event.target.value.toUpperCase())}
                placeholder="ORG-1A2B"
                aria-invalid={Boolean(errors.accountId)}
              />
              {errors.accountId && <span style={errorStyle}>{errors.accountId}</span>}
            </label>

            <label style={labelStyle}>
              <span>Primary contact name</span>
              <input
                style={inputStyle}
                value={form.contactName}
                onChange={(event) => updateField("contactName", event.target.value)}
                placeholder="Ari Patel"
                aria-invalid={Boolean(errors.contactName)}
              />
              {errors.contactName && <span style={errorStyle}>{errors.contactName}</span>}
            </label>

            <label style={labelStyle}>
              <span>Email for onboarding notifications</span>
              <input
                style={inputStyle}
                value={form.contactEmail}
                onChange={(event) => updateField("contactEmail", event.target.value)}
                placeholder="ari@example.com"
                aria-invalid={Boolean(errors.contactEmail)}
              />
              {errors.contactEmail && <span style={errorStyle}>{errors.contactEmail}</span>}
            </label>

            <div style={{ fontSize: "13px", color: "#475467" }}>
              We send mandate status, shortfall alerts, and BAS reminders to the nominated contact. You can add more recipients
              later under Security → Access control.
            </div>
          </div>
        )}

        {currentStep.id === "agreements" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#1d2633" }}>
              Review the{" "}
              <a href="/legal#terms" target="_blank" rel="noreferrer" style={{ color: "#0b5fff" }}>
                Terms of Use
              </a>
              ,{" "}
              <a href="/legal#privacy" target="_blank" rel="noreferrer" style={{ color: "#0b5fff" }}>
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/legal#direct-debit" target="_blank" rel="noreferrer" style={{ color: "#0b5fff" }}>
                Direct Debit Authority
              </a>
              . We keep a timestamped audit trail for every acceptance.
            </p>

            <label style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={form.acceptedTerms}
                onChange={(event) => updateField("acceptedTerms", event.target.checked)}
              />
              <span>I confirm I am authorised to accept the APGMS Terms of Use.</span>
            </label>
            {errors.acceptedTerms && <span style={errorStyle}>{errors.acceptedTerms}</span>}

            <label style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={form.acceptedPrivacy}
                onChange={(event) => updateField("acceptedPrivacy", event.target.checked)}
              />
              <span>I have read and agree to the APGMS Privacy Policy, including TFN handling rules.</span>
            </label>
            {errors.acceptedPrivacy && <span style={errorStyle}>{errors.acceptedPrivacy}</span>}

            <label style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={form.acceptedDebit}
                onChange={(event) => handleDirectDebitToggle(event.target.checked)}
              />
              <span>
                I authorise APGMS Pty Ltd to debit the nominated account via PayTo for BAS shortfalls and PAYGW remittances.
              </span>
            </label>
            {errors.acceptedDebit && <span style={errorStyle}>{errors.acceptedDebit}</span>}

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={downloadAgreement}
                style={{
                  border: "1px solid #0b5fff",
                  background: "rgba(11, 95, 255, 0.08)",
                  color: "#0b5fff",
                  padding: "10px 16px",
                  borderRadius: "999px",
                  cursor: "pointer",
                }}
              >
                Download direct debit authority
              </button>
              {directDebitAudit && (
                <span style={{ fontSize: "13px", color: "#475467" }}>
                  Last accepted {new Date(directDebitAudit.acceptedAt).toLocaleString()} by {directDebitAudit.contactName}.
                </span>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              background: "transparent",
              border: "1px solid #cbd5f5",
              borderRadius: "8px",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            {stepIndex === 0 ? "Exit" : "Back"}
          </button>

          {stepIndex < steps.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              style={{
                background: "#0b5fff",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 18px",
                cursor: "pointer",
              }}
            >
              Continue to {steps[stepIndex + 1].label}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                background: "#0f766e",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 18px",
                cursor: "pointer",
              }}
            >
              Complete onboarding
            </button>
          )}
        </div>
      </section>

      {submissionTimestamp && (
        <section style={cardStyle}>
          <h2 style={{ margin: 0 }}>Submission summary</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "200px 1fr", rowGap: "8px", columnGap: "16px", margin: 0 }}>
            <dt style={{ fontWeight: 600 }}>Entity</dt>
            <dd style={{ margin: 0 }}>{form.entityName || "Pending"}</dd>
            <dt style={{ fontWeight: 600 }}>ABN</dt>
            <dd style={{ margin: 0 }}>{form.abn ? formatAbn(form.abn) : "Pending"}</dd>
            <dt style={{ fontWeight: 600 }}>TFN</dt>
            <dd style={{ margin: 0 }}>{form.tfn ? maskTfn(form.tfn) : "Not provided"}</dd>
            <dt style={{ fontWeight: 600 }}>Account ID</dt>
            <dd style={{ margin: 0 }}>{form.accountId || "Pending"}</dd>
            <dt style={{ fontWeight: 600 }}>Contact</dt>
            <dd style={{ margin: 0 }}>{form.contactName || "Pending"}</dd>
            <dt style={{ fontWeight: 600 }}>Email</dt>
            <dd style={{ margin: 0 }}>{form.contactEmail || "Pending"}</dd>
            <dt style={{ fontWeight: 600 }}>Submitted</dt>
            <dd style={{ margin: 0 }}>{new Date(submissionTimestamp).toLocaleString()}</dd>
          </dl>
          <p style={{ margin: 0, fontSize: "13px", color: "#475467" }}>
            The onboarding record is stored locally for reference. API integration would POST this payload to
            /onboarding/submissions with TFNs encrypted and masked in logs.
          </p>
        </section>
      )}
    </div>
  );
}
