import React, { useEffect, useState } from "react";
import { fetchBasPreview, lodgeBas, fetchDesignatedAccounts } from "./api";
import { getToken } from "./auth";

type BasPreview = Awaited<ReturnType<typeof fetchBasPreview>>;
type DesignatedAccounts = Awaited<ReturnType<typeof fetchDesignatedAccounts>>;
type DesignatedAccountView = DesignatedAccounts["accounts"][number];

export default function BasPage() {
  const token = getToken();
  const [preview, setPreview] = useState<BasPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [designated, setDesignated] = useState<DesignatedAccounts | null>(null);
  const [designatedError, setDesignatedError] = useState<string | null>(null);

  const loadPreview = async () => {
    if (!token) return;
    setError(null);
    setDesignatedError(null);
    setLoading(true);
    try {
      const data = await fetchBasPreview(token);
      setPreview(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load BAS preview");
      setLoading(false);
      return;
    }

    try {
      const designatedData = await fetchDesignatedAccounts(token);
      setDesignated(designatedData);
    } catch (designatedErr) {
      console.error(designatedErr);
      setDesignated(null);
      setDesignatedError("Unable to load designated holding accounts");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadPreview();
  }, [token]);

  async function handleLodge() {
    if (!token) return;
    setSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const result = await lodgeBas(token);
      setSuccess(`BAS lodged at ${new Date(result.basCycle.lodgedAt).toLocaleString()}`);
      await loadPreview();
    } catch (err) {
      console.error(err);
      setError("BAS could not be lodged. Check blockers and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return null;
  }

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

      {loading && <div style={infoTextStyle}>Loading BAS preview...</div>}
      {error && <div style={errorTextStyle}>{error}</div>}
      {success && <div style={successTextStyle}>{success}</div>}

      {preview && !error && hasActiveCycle && (
        <>
          <section style={overviewCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={statusBadgeStyle(preview.overallStatus)}>
                {preview.overallStatus === "READY" ? "READY" : "BLOCKED"}
              </span>
              <div>
                <div style={overviewTitleStyle}>BAS period {periodStart} to {periodEnd}</div>
                <div style={metaTextStyle}>
                  The ATO payment is automatically triggered if all obligations are secured.
                </div>
              </div>
            </div>
            {preview.overallStatus === "READY" && (
              <button
                type="button"
                style={lodgeButtonStyle}
                onClick={handleLodge}
                disabled={submitting}
              >
                {submitting ? "Lodging..." : "Lodge BAS now"}
              </button>
            )}
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
          {designatedError && <div style={errorTextStyle}>{designatedError}</div>}
          {!designated && !designatedError && (
            <div style={infoTextStyle}>Loading holding account balances...</div>
          )}
          {designated && (
            <div style={accountsGridStyle}>
              <HoldingAccountCard title="PAYGW holding account" account={paygwAccount} />
              <HoldingAccountCard title="GST holding account" account={gstAccount} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function HoldingAccountCard({ title, account }: { title: string; account: DesignatedAccountView | null }) {
  const balance = account?.balance ?? 0;
  const palette = account
    ? balance > 0
      ? { background: "rgba(16, 185, 129, 0.12)", text: "#047857" }
      : { background: "rgba(250, 204, 21, 0.18)", text: "#92400e" }
    : { background: "rgba(148, 163, 184, 0.18)", text: "#334155" };

  return (
    <div style={accountsCardColumnStyle}>
      <div style={accountsCardHeaderStyle}>
        <h3 style={accountsCardTitleStyle}>{title}</h3>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            backgroundColor: palette.background,
            color: palette.text,
          }}
        >
          {account ? "Inbound only" : "Not provisioned"}
        </span>
      </div>
      <div style={accountsBalanceStyle}>{currencyFormatter.format(balance)}</div>
      <div style={accountsUpdatedStyle}>
        {account ? `Updated ${new Date(account.updatedAt).toLocaleString()}` : "Configure in database seed"}
      </div>
      <div>
        <div style={accountsTransfersTitleStyle}>Recent transfers</div>
        {account && account.transfers.length > 0 ? (
          <ul style={accountsTransfersListStyle}>
            {account.transfers.map((transfer) => (
              <li key={transfer.id} style={accountsTransferItemStyle}>
                <div>{currencyFormatter.format(transfer.amount)}</div>
                <div style={accountsTransferMetaStyle}>
                  {transfer.source} - {new Date(transfer.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={infoTextStyle}>
            {account ? "No transfers recorded yet." : "No account created yet."}
          </div>
        )}
      </div>
    </div>
  );
}

function ObligationCard({
  title,
  data,
}: {
  title: string;
  data: { required: number; secured: number; status: string };
}) {
  const palette = statusPalette(data.status);
  return (
    <div style={obligationCardStyle}>
      <div style={cardHeaderStyle}>
        <h3 style={obligationTitleStyle}>{title}</h3>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "20px",
            backgroundColor: palette.background,
            color: palette.text,
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {data.status}
        </span>
      </div>
      <dl style={metricsListStyle}>
        <div style={metricRowStyle}>
          <dt style={metricLabelStyle}>Required</dt>
          <dd style={metricValueStyle}>{formatCurrency(data.required)}</dd>
        </div>
        <div style={metricRowStyle}>
          <dt style={metricLabelStyle}>Secured</dt>
          <dd style={metricValueStyle}>{formatCurrency(data.secured)}</dd>
        </div>
        <div style={metricRowStyle}>
          <dt style={metricLabelStyle}>Gap</dt>
          <dd style={metricValueStyle}>
            {formatCurrency(Math.max(0, Math.round((data.required - data.secured) * 100) / 100))}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function statusPalette(status: string) {
  switch (status.toUpperCase()) {
    case "READY":
      return { background: "rgba(16, 185, 129, 0.12)", text: "#047857" };
    case "BLOCKED":
      return { background: "rgba(239, 68, 68, 0.12)", text: "#b91c1c" };
    default:
      return { background: "rgba(250, 204, 21, 0.18)", text: "#92400e" };
  }
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

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

const errorTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#b91c1c",
};

const successTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#047857",
};

const overviewCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "24px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const overviewTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  marginBottom: "4px",
};

const metaTextStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
};

const statusBadgeStyle = (status: string): React.CSSProperties => ({
  padding: "6px 12px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: 600,
  backgroundColor: status === "READY" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
  color: status === "READY" ? "#047857" : "#b91c1c",
});

const lodgeButtonStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "10px 16px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#111827",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const gridTwoColumns: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const obligationCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};

const obligationTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 600,
};

const metricsListStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "8px",
};

const metricRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
};

const blockersCardStyle: React.CSSProperties = {
  backgroundColor: "#fff9f0",
  borderRadius: "12px",
  padding: "20px 24px",
  border: "1px solid #fed7aa",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  marginBottom: "12px",
};

const blockersListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "20px",
  display: "grid",
  gap: "8px",
  color: "#92400e",
  fontSize: "14px",
};

const blockerItemStyle: React.CSSProperties = {
  lineHeight: 1.5,
};

const accountsCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  padding: "24px",
  display: "grid",
  gap: "16px",
};

const accountsTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 600,
};

const accountsSubtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  color: "#4b5563",
  maxWidth: "620px",
};

const accountsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const accountsCardColumnStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  borderRadius: "12px",
  border: "1px solid #dbeafe",
  padding: "18px",
  display: "grid",
  gap: "12px",
};

const accountsCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const accountsCardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 600,
};

const accountsBalanceStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#0f172a",
};

const accountsUpdatedStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
};

const accountsTransfersTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 600,
  color: "#64748b",
};

const accountsTransfersListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "8px",
};

const accountsTransferItemStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "10px",
  padding: "10px",
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: "4px",
};

const accountsTransferMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
};
