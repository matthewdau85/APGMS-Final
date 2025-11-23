import React, { useEffect, useState } from "react";
import {
  fetchBasPreview,
  lodgeBas,
  fetchDesignatedAccounts,
  fetchPaymentPlanRequest,
  createPaymentPlanRequest,
  initiateMfa,
} from "./api";
import { getToken, getSessionUser } from "./auth";
import { ErrorState, SkeletonBlock, StatusChip, StatCard } from "./components/UI";

type BasPreviewResponse = Awaited<ReturnType<typeof fetchBasPreview>>;
type DesignatedAccountsResponse = Awaited<ReturnType<typeof fetchDesignatedAccounts>>;
type DesignatedAccountView = DesignatedAccountsResponse["accounts"][number];
type PaymentPlanResponse = Awaited<ReturnType<typeof fetchPaymentPlanRequest>>["request"];

export default function BasPage() {
  const token = getToken();
  const sessionUser = getSessionUser();
  const [preview, setPreview] = useState<BasPreviewResponse | null>(null);
  const [designated, setDesignated] = useState<DesignatedAccountsResponse | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [designatedError, setDesignatedError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSuccess, setPlanSuccess] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const basCycleId = preview?.basCycleId ?? null;

  useEffect(() => {
    if (!token) return;
    void loadPreview();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (basCycleId) {
      void loadPaymentPlan(basCycleId);
    } else {
      setPaymentPlan(null);
      setPlanError(null);
      setPlanSuccess(null);
    }
  }, [token, basCycleId]);

  async function loadPreview() {
    if (!token) return;
    setError(null);
    setDesignatedError(null);
    setLoading(true);
    try {
      const [previewData, designatedData] = await Promise.all([
        fetchBasPreview(token),
        fetchDesignatedAccounts(token),
      ]);
      setPreview(previewData);
      setDesignated(designatedData);
    } catch (err) {
      console.error(err);
      setError("Unable to load BAS preview");
    } finally {
      setLoading(false);
    }
  }

  async function loadPaymentPlan(cycleId: string) {
    if (!token) return;
    setPlanError(null);
    setPlanSuccess(null);
    setPlanLoading(true);
    try {
      const response = await fetchPaymentPlanRequest(token, cycleId);
      setPaymentPlan(response.request);
    } catch (err) {
      console.error(err);
      setPlanError("Unable to load payment plan status");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleLodge() {
    if (!token) return;
    setSubmitting(true);
    setSuccess(null);
    setError(null);

    let lodged = false;
    let requiresMfa = false;
    let lodgmentResult: Awaited<ReturnType<typeof lodgeBas>> | null = null;

    try {
      const result = await lodgeBas(token);
      lodgmentResult = result;
      lodged = true;
    } catch (err) {
      if (err instanceof Error && err.message === "mfa_required" && sessionUser?.mfaEnabled) {
        requiresMfa = true;
      } else {
        console.error(err);
        setError("BAS could not be lodged. Check blockers and try again.");
      }
    }

    if (!lodged && requiresMfa) {
      try {
        const challenge = await initiateMfa(token);
        window.alert(
          `MFA verification required for BAS lodgment.\n\nDev stub code: ${challenge.code} (expires in ${challenge.expiresInSeconds}s).`
        );
        const supplied = window.prompt(
          "Enter the MFA code to authorise BAS lodgment:",
          challenge.code
        );
        if (!supplied || supplied.trim().length === 0) {
          setError("MFA verification cancelled.");
        } else {
          const result = await lodgeBas(token, { mfaCode: supplied.trim() });
          lodgmentResult = result;
          lodged = true;
        }
      } catch (err) {
        console.error(err);
        setError("MFA verification failed. Please try again.");
      }
    }

    if (lodged && lodgmentResult) {
      setSuccess(`BAS lodged at ${new Date(lodgmentResult.basCycle.lodgedAt).toLocaleString()}`);
      await loadPreview();
      if (lodgmentResult.basCycle.id) {
        await loadPaymentPlan(lodgmentResult.basCycle.id);
      }
    }

    setSubmitting(false);
  }

  async function handleCreatePaymentPlan() {
    if (!token || !basCycleId) return;
    const reason = window.prompt("Reason for payment plan", "CASHFLOW_SHORTFALL");
    if (!reason || reason.trim() === "") return;
    const weeklyAmountInput = window.prompt("Weekly amount (AUD)", "1500");
    if (!weeklyAmountInput) return;
    const weeklyAmount = Number(weeklyAmountInput);
    if (!Number.isFinite(weeklyAmount) || weeklyAmount <= 0) {
      setPlanError("Weekly amount must be a positive number");
      return;
    }
    const startDate = window.prompt("Proposed start date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!startDate) return;
    const notes = window.prompt("Additional notes (optional)") ?? undefined;

    setPlanError(null);
    setPlanSuccess(null);
    setPlanLoading(true);
    try {
      const response = await createPaymentPlanRequest(token, {
        basCycleId,
        reason: reason.trim(),
        weeklyAmount,
        startDate,
        notes,
      });
      setPaymentPlan(response.request);
      setPlanSuccess("Payment plan request submitted and logged");
    } catch (err) {
      console.error(err);
      setPlanError("Unable to submit payment plan request");
    } finally {
      setPlanLoading(false);
    }
  }

  if (!token) return null;

  const hasActiveCycle = Boolean(preview?.periodStart && preview?.periodEnd);
  const periodStart = hasActiveCycle && preview?.periodStart ? new Date(preview.periodStart).toLocaleDateString() : null;
  const periodEnd = hasActiveCycle && preview?.periodEnd ? new Date(preview.periodEnd).toLocaleDateString() : null;
  const paygwAccount = designated?.accounts.find((account) => account.type.toUpperCase() === "PAYGW") ?? null;
  const gstAccount = designated?.accounts.find((account) => account.type.toUpperCase() === "GST") ?? null;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header>
        <h1 style={pageTitleStyle}>BAS Lodgment</h1>
        <p style={pageSubtitleStyle}>
          We preview the BAS position before lodgment. If obligations are underfunded, the system blocks the transfer and surfaces blockers.
        </p>
      </header>

      {loading && (
        <div style={{ display: "grid", gap: 8 }}>
          <SkeletonBlock width="50%" />
          <SkeletonBlock width="100%" height={140} />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={loadPreview} detail="We could not load BAS preview." />}
      {success && <div style={successTextStyle}>{success}</div>}

      {preview && !error && hasActiveCycle && (
        <>
          <section style={overviewCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <StatusChip tone={preview.overallStatus === "READY" ? "success" : "warning"}>
                {preview.overallStatus === "READY" ? "Ready" : "Blocked"}
              </StatusChip>
              <div>
                <div style={overviewTitleStyle}>BAS period {periodStart} to {periodEnd}</div>
                <div style={metaTextStyle}>
                  The ATO payment is automatically triggered if all obligations are secured.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="app-button"
                onClick={handleLodge}
                disabled={submitting || preview.overallStatus !== "READY"}
              >
                {submitting ? "Lodging..." : "Lodge BAS now"}
              </button>
            </div>
          </section>

          <section style={gridTwoColumns}>
            <ObligationCard title="PAYGW" data={preview.paygw} />
            <ObligationCard title="GST" data={preview.gst} />
          </section>

          {preview.blockers.length > 0 && (
            <section style={blockersCardStyle}>
              <h2 style={sectionTitleStyle}>Why we are blocked</h2>
              <ul style={blockersListStyle}>
                {preview.blockers.map((blocker, idx) => (
                  <li key={idx} style={blockerItemStyle}>
                    {blocker}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {preview && !error && !hasActiveCycle && (
        <section style={overviewCardStyle}>
          <div style={{ fontSize: "16px", fontWeight: 600 }}>No active BAS cycle</div>
          <p style={{ fontSize: "14px", color: "#4b5563", margin: 0 }}>
            All BAS cycles are lodged. Seed a new period in the database to continue the demo.
          </p>
        </section>
      )}

      {(designated || designatedError) && (
        <section style={accountsCardStyle}>
          <h2 style={accountsTitleStyle}>Designated holding accounts</h2>
          <p style={accountsSubtitleStyle}>
            The ATO transfer draws directly from these PAYGW and GST designated accounts when you lodge.
          </p>
          {designatedError && <ErrorState message={designatedError} detail="Holding accounts unavailable." />}
          {!designated && !designatedError && (
            <div style={{ display: "grid", gap: 8 }}>
              <SkeletonBlock width="100%" height={60} />
              <SkeletonBlock width="100%" height={60} />
            </div>
          )}
          {designated && (
            <div style={accountsGridStyle}>
              <HoldingAccountCard title="PAYGW holding account" account={paygwAccount} />
              <HoldingAccountCard title="GST holding account" account={gstAccount} />
            </div>
          )}
        </section>
      )}

      {(basCycleId && preview && (preview.overallStatus !== "READY" || paymentPlan)) && (
        <section style={planCardStyle}>
          <div style={planHeaderStyle}>
            <h2 style={planTitleStyle}>Payment plan request</h2>
            <StatusChip tone={paymentPlan ? statusTone(paymentPlan.status) : "neutral"}>
              {paymentPlan ? paymentPlan.status : "NONE"}
            </StatusChip>
          </div>
          <p style={planSubtitleStyle}>
            Shortfalls can be escalated to the ATO early. Request a structured payment plan so the evidence trail shows good faith remediation.
          </p>
          {planError && <ErrorState message={planError} onRetry={() => basCycleId && loadPaymentPlan(basCycleId)} />}
          {planSuccess && <div style={successTextStyle}>{planSuccess}</div>}
          {planLoading && <div style={infoTextStyle}>Checking payment plan status...</div>}
          {paymentPlan ? (
            <div style={planDetailsGridStyle}>
              <div>
                <div style={planDetailLabelStyle}>Requested</div>
                <div style={planDetailValueStyle}>{new Date(paymentPlan.requestedAt).toLocaleString()}</div>
              </div>
              <div>
                <div style={planDetailLabelStyle}>Reason</div>
                <div style={planDetailValueStyle}>{paymentPlan.reason}</div>
              </div>
              <div>
                <div style={planDetailLabelStyle}>Details</div>
                <div style={planDetailValueStyle}>
                  {JSON.stringify(paymentPlan.details)}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="app-button ghost"
              onClick={handleCreatePaymentPlan}
              disabled={planLoading}
            >
              Request payment plan
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function HoldingAccountCard({ title, account }: { title: string; account: DesignatedAccountView | null }) {
  const balance = account?.balance ?? 0;
  const tone = balance > 0 ? "success" : "warning";
  return (
    <div style={accountsCardColumnStyle}>
      <div style={accountsCardHeaderStyle}>
        <h3 style={accountsCardTitleStyle}>{title}</h3>
        <StatusChip tone={tone}>{account ? "Inbound only" : "Not provisioned"}</StatusChip>
      </div>
      <div style={accountsBalanceStyle}>{currencyFormatter.format(balance)}</div>
      <div style={accountsUpdatedStyle}>
        Last updated {account?.updatedAt ? new Date(account.updatedAt).toLocaleString() : "N/A"}
      </div>
    </div>
  );
}

function ObligationCard({ title, data }: { title: string; data: BasPreviewResponse["paygw"] }) {
  const shortfall = Math.max(0, (data.required ?? 0) - (data.secured ?? 0));
  const tone = shortfall > 0 ? "warning" : "success";
  return (
    <div style={obligationCardStyle}>
      <div style={obligationHeaderStyle}>
        <h3 style={obligationTitleStyle}>{title}</h3>
        <StatusChip tone={tone}>{shortfall > 0 ? "Short" : "Covered"}</StatusChip>
      </div>
      <div style={obligationValueStyle}>{currencyFormatter.format(data.secured ?? 0)}</div>
      <div style={obligationMetaStyle}>Required: {currencyFormatter.format(data.required ?? 0)}</div>
      {shortfall > 0 && <div style={obligationMetaStyle}>Shortfall: {currencyFormatter.format(shortfall)}</div>}
    </div>
  );
}

function statusTone(status: string) {
  const upper = status.toUpperCase();
  if (upper === "READY" || upper === "OK") return "success";
  if (upper === "PARTIAL" || upper === "PENDING") return "warning";
  if (upper === "BLOCKED" || upper === "FAILED") return "danger";
  return "neutral";
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const pageTitleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  marginBottom: "8px",
};

const pageSubtitleStyle: React.CSSProperties = {
  color: "#4b5563",
  margin: 0,
  fontSize: "14px",
  maxWidth: "620px",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
};

const overviewCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const overviewTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  margin: 0,
};

const metaTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
};

const gridTwoColumns: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const blockersCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const blockersListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "18px",
  color: "#1f2937",
};

const blockerItemStyle: React.CSSProperties = {
  marginBottom: "6px",
};

const accountsCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "12px",
};

const accountsTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  margin: 0,
};

const accountsSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
  margin: 0,
};

const accountsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const accountsCardColumnStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "14px",
  background: "#fff",
  display: "grid",
  gap: "6px",
};

const accountsCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const accountsCardTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
};

const accountsBalanceStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 800,
};

const accountsUpdatedStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
};

const planCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "12px",
};

const planHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const planTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  margin: 0,
};

const planSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
  margin: 0,
};

const planDetailsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const planDetailLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const planDetailValueStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#111827",
};

const obligationCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "14px",
  background: "#fff",
  display: "grid",
  gap: "6px",
};

const obligationHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const obligationTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
};

const obligationValueStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 800,
};

const obligationMetaStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#4b5563",
};

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};
