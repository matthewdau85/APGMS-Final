import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchBankLines,
  fetchCurrentObligations,
  createBankLine,
  fetchDesignatedAccounts,
} from "./api";
import { getToken } from "./auth";
import { ErrorState, SkeletonBlock, StatCard, StatusChip } from "./components/UI";

type Obligations = Awaited<ReturnType<typeof fetchCurrentObligations>>;
type BankLine = Awaited<ReturnType<typeof fetchBankLines>>["lines"][number];
type DesignatedAccounts = Awaited<ReturnType<typeof fetchDesignatedAccounts>>;

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

export default function DashboardPage() {
  const token = getToken();
  const [obligations, setObligations] = useState<Obligations | null>(null);
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [designated, setDesignated] = useState<DesignatedAccounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [designatedError, setDesignatedError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    date: new Date().toISOString(),
    amount: "123.45",
    payee: "ATO Sweep",
    desc: "PAYGW escrow capture",
  });

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setDesignatedError(null);
    try {
      const [obligationsResponse, bankLinesResponse] = await Promise.all([
        fetchCurrentObligations(token),
        fetchBankLines(token),
      ]);
      setObligations(obligationsResponse);
      setBankLines(bankLinesResponse.lines);
    } catch (err) {
      console.error(err);
      setError("Unable to load dashboard data");
      setLoading(false);
      return;
    }

    try {
      const designatedResponse = await fetchDesignatedAccounts(token);
      setDesignated(designatedResponse);
      setDesignatedError(null);
    } catch (designatedErr) {
      console.error(designatedErr);
      setDesignatedError("Unable to load designated account balances");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void loadData();
  }, [token, loadData]);

  const paygwGap = useMemo(() => {
    if (!obligations) return 0;
    return Math.max(0, obligations.paygw.required - obligations.paygw.secured);
  }, [obligations]);

  const gstGap = useMemo(() => {
    if (!obligations) return 0;
    return Math.max(0, obligations.gst.required - obligations.gst.secured);
  }, [obligations]);

  const nextBasDueDisplay = useMemo(() => {
    if (!obligations?.nextBasDue) return "Not scheduled";
    return new Date(obligations.nextBasDue).toLocaleString();
  }, [obligations]);

  const paygwDesignatedAccount = useMemo(
    () =>
      designated?.accounts.find(
        (account) => account.type.toUpperCase() === "PAYGW"
      ) ?? null,
    [designated]
  );

  const gstDesignatedAccount = useMemo(
    () =>
      designated?.accounts.find(
        (account) => account.type.toUpperCase() === "GST"
      ) ?? null,
    [designated]
  );

  async function handleCreateLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!token) return;
    try {
      await createBankLine(token, formState);
      const refreshed = await fetchBankLines(token);
      setBankLines(refreshed.lines);
    } catch (err) {
      console.error(err);
      setFormError("Unable to create ledger entry");
    }
  }

  if (!token) return null;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header>
        <h1 style={pageTitleStyle}>Compliance Control Room</h1>
        <p style={pageSubtitleStyle}>
          Snapshot of PAYGW and GST obligations, plus the ledger evidence we share with the ATO to prove funds are secured.
        </p>
      </header>

      {loading && (
        <div style={{ display: "grid", gap: 8 }}>
          <SkeletonBlock width="50%" />
          <SkeletonBlock width="100%" height={120} />
          <SkeletonBlock width="100%" height={160} />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={loadData} detail="We could not load dashboard data." />}

      {obligations && !error && (
        <>
          <section style={summaryGridStyle}>
            <StatCard
              title="PAYGW"
              value={`${currencyFormatter.format(obligations.paygw.secured)} / ${currencyFormatter.format(obligations.paygw.required)}`}
              subtitle={`Status: ${obligations.paygw.status}`}
              tone={statusTone(obligations.paygw.status)}
            />
            <StatCard
              title="GST"
              value={`${currencyFormatter.format(obligations.gst.secured)} / ${currencyFormatter.format(obligations.gst.required)}`}
              subtitle={`Status: ${obligations.gst.status}`}
              tone={statusTone(obligations.gst.status)}
            />
            <StatCard title="Shortfall" value={currencyFormatter.format(paygwGap + gstGap)} tone={paygwGap + gstGap > 0 ? "warning" : "success"} />
            <StatCard title="Next BAS Due" value={nextBasDueDisplay} />
          </section>

          {(designated || designatedError) && (
            <section style={designatedSectionStyle}>
              <div style={designatedHeaderStyle}>
                <h2 style={designatedTitleStyle}>Designated Accounts</h2>
                <p style={designatedSubtitleStyle}>
                  PAYGW and GST cash is ringfenced in inbound-only accounts. Shortfalls appear here before BAS lodgment.
                </p>
              </div>
              {designatedError && <ErrorState message={designatedError} detail="Holding account balances unavailable." />}
              {!designated && !designatedError && (
                <div style={{ display: "grid", gap: 8 }}>
                  <SkeletonBlock width="100%" height={60} />
                  <SkeletonBlock width="100%" height={60} />
                </div>
              )}
              {designated && (
                <div style={designatedGridStyle}>
                  <DesignatedAccountCard
                    title="PAYGW Holding Account"
                    account={paygwDesignatedAccount}
                    required={obligations.paygw.required}
                  />
                  <DesignatedAccountCard
                    title="GST Holding Account"
                    account={gstDesignatedAccount}
                    required={obligations.gst.required}
                  />
                </div>
              )}
            </section>
          )}

          <section style={ledgerCardStyle}>
            <div style={ledgerHeaderStyle}>
              <div>
                <h2 style={ledgerTitleStyle}>Bank Ledger Evidence</h2>
                <p style={ledgerSubtitleStyle}>
                  Every protected withdrawal or capture is audited. Shortfall right now: {currencyFormatter.format(paygwGap + gstGap)}.
                </p>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Posted</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {bankLines.map((line) => (
                    <tr key={line.id}>
                      <td style={tdStyle}>{line.id}</td>
                      <td style={tdStyle}>{new Date(line.postedAt).toLocaleString()}</td>
                      <td style={tdStyle}>{currencyFormatter.format(line.amount)}</td>
                      <td style={tdStyle}>{line.description}</td>
                      <td style={tdStyle}>{new Date(line.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bankLines.length === 0 && (
                <div style={{ ...infoTextStyle, padding: "12px 0" }}>
                  No ledger activity recorded yet.
                </div>
              )}
            </div>

            <form onSubmit={handleCreateLine} style={ledgerFormStyle}>
              <div style={formGridStyle}>
                <label style={formLabelStyle}>
                  <span>Date (ISO)</span>
                  <input
                    style={formInputStyle}
                    value={formState.date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </label>
                <label style={formLabelStyle}>
                  <span>Amount (AUD)</span>
                  <input
                    style={formInputStyle}
                    value={formState.amount}
                    onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </label>
                <label style={formLabelStyle}>
                  <span>Payee</span>
                  <input
                    style={formInputStyle}
                    value={formState.payee}
                    onChange={(e) => setFormState((prev) => ({ ...prev, payee: e.target.value }))}
                  />
                </label>
                <label style={formLabelStyle}>
                  <span>Description</span>
                  <input
                    style={formInputStyle}
                    value={formState.desc}
                    onChange={(e) => setFormState((prev) => ({ ...prev, desc: e.target.value }))}
                  />
                </label>
              </div>
              {formError && <div style={errorTextStyle}>{formError}</div>}
              <div>
                <button type="submit" className="app-button">
                  Create ledger entry
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

function statusTone(status: string) {
  const upper = status.toUpperCase();
  if (upper === "READY" || upper === "OK") return "success";
  if (upper === "SHORT" || upper === "BLOCKED" || upper === "ALERT") return "warning";
  return "neutral";
}

function DesignatedAccountCard({
  title,
  account,
  required,
}: {
  title: string;
  account: DesignatedAccounts["accounts"][number] | null;
  required: number;
}) {
  const balance = account?.balance ?? 0;
  const tone = balance >= required ? "success" : balance > 0 ? "warning" : "danger";
  return (
    <div style={designatedCardStyle}>
      <div style={designatedCardHeaderStyle}>
        <div>
          <div style={designatedCardTitleStyle}>{title}</div>
          <div style={designatedCardSubStyle}>Inbound-only</div>
        </div>
        <StatusChip tone={tone}>{balance >= required ? "Covered" : balance > 0 ? "Partial" : "Short"}</StatusChip>
      </div>
      <div style={designatedBalanceStyle}>{currencyFormatter.format(balance)}</div>
      <div style={designatedMetaStyle}>
        Last updated {account?.updatedAt ? new Date(account.updatedAt).toLocaleString() : "N/A"}
      </div>
    </div>
  );
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
  maxWidth: "700px",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
};

const designatedSectionStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "12px",
};

const designatedHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const designatedTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  margin: 0,
};

const designatedSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
  margin: 0,
};

const designatedGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const designatedCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "14px",
  background: "#fff",
  display: "grid",
  gap: "6px",
};

const designatedCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const designatedCardTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
};

const designatedCardSubStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
};

const designatedBalanceStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 800,
};

const designatedMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
};

const ledgerCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "24px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "12px",
};

const ledgerHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const ledgerTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  margin: 0,
};

const ledgerSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
  margin: 0,
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6b7280",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "14px",
  borderBottom: "1px solid #f1f5f9",
  color: "#111827",
};

const ledgerFormStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  marginTop: "12px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const formLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  fontSize: "14px",
  color: "#111827",
};

const formInputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  fontSize: "14px",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#b91c1c",
};
