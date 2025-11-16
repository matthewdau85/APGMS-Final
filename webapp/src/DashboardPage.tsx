import React, { useEffect, useMemo, useState } from "react";
import {
  fetchBankLines,
  fetchCurrentObligations,
  createBankLine,
  fetchDesignatedAccounts,
  fetchVirtualBalance,
  fetchTaxPrediction,
  fetchAlerts,
} from "./api";
import { getToken } from "./auth";

import type { SubscriptionTier } from "./api";

type Obligations = Awaited<ReturnType<typeof fetchCurrentObligations>>;
type BankLine = Awaited<ReturnType<typeof fetchBankLines>>["lines"][number];
type DesignatedAccounts = Awaited<ReturnType<typeof fetchDesignatedAccounts>>;
type VirtualBalance = Awaited<ReturnType<typeof fetchVirtualBalance>>;
type PredictionEnvelope = Awaited<ReturnType<typeof fetchTaxPrediction>>;
type AlertRecord = Awaited<ReturnType<typeof fetchAlerts>>["alerts"][number];

type DerivedAlert = {
  id: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  source: "derived" | "system";
  createdAt?: string;
};

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-AU", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default function DashboardPage() {
  const token = getToken();
  const [obligations, setObligations] = useState<Obligations | null>(null);
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [designated, setDesignated] = useState<DesignatedAccounts | null>(null);
  const [virtualBalance, setVirtualBalance] = useState<VirtualBalance | null>(null);
  const [prediction, setPrediction] = useState<PredictionEnvelope | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [designatedError, setDesignatedError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [formState, setFormState] = useState({
    date: "2025-10-20T00:00:00.000Z",
    amount: "123.45",
    payee: "ATO Sweep",
    desc: "PAYGW escrow capture",
  });

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [obligationsResponse, bankLinesResponse, balanceResponse, predictionResponse, alertsResponse] =
          await Promise.all([
            fetchCurrentObligations(token),
            fetchBankLines(token),
            fetchVirtualBalance(token),
            fetchTaxPrediction(token, 45),
            fetchAlerts(token),
          ]);
        if (cancelled) {
          return;
        }
        setObligations(obligationsResponse);
        setBankLines(bankLinesResponse.lines);
        setVirtualBalance(balanceResponse);
        setPrediction(predictionResponse);
        setAlerts(alertsResponse.alerts);
        setTier(predictionResponse.tier);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Unable to load dashboard data");
          setLoading(false);
        }
        return;
      }

      try {
        const designatedResponse = await fetchDesignatedAccounts(token);
        if (!cancelled) {
          setDesignated(designatedResponse);
          setDesignatedError(null);
        }
      } catch (designatedErr) {
        console.error(designatedErr);
        if (!cancelled) {
          setDesignatedError("Unable to load designated account balances");
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

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
      designated?.accounts.find((account) => account.type.toUpperCase() === "PAYGW") ?? null,
    [designated],
  );

  const gstDesignatedAccount = useMemo(
    () =>
      designated?.accounts.find((account) => account.type.toUpperCase() === "GST") ?? null,
    [designated],
  );

  const derivedAlerts = useMemo<DerivedAlert[]>(() => {
    const collection: DerivedAlert[] = [];
    if (virtualBalance) {
      if (virtualBalance.discretionaryBalance < 0) {
        collection.push({
          id: "derived-negative-discretionary",
          message: "Discretionary cash is negative. Investigate buffer transfers immediately.",
          severity: "HIGH",
          source: "derived",
        });
      } else if (virtualBalance.discretionaryBalance < virtualBalance.taxReserved * 0.2) {
        collection.push({
          id: "derived-low-discretionary",
          message: "Discretionary cash is trending low versus reserved tax funds.",
          severity: "MEDIUM",
          source: "derived",
        });
      }
    }
    if (obligations?.nextBasDue) {
      const dueDate = new Date(obligations.nextBasDue);
      const daysUntil = Math.max(0, Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      if (daysUntil <= 14) {
        collection.push({
          id: "derived-bas-window",
          message: `BAS lodgment window closes in ${daysUntil} days`,
          severity: daysUntil <= 5 ? "HIGH" : "MEDIUM",
          source: "derived",
          createdAt: dueDate.toISOString(),
        });
      }
    }
    return collection;
  }, [virtualBalance, obligations]);

  const alertCards = useMemo(() => {
    const systemAlerts: DerivedAlert[] = alerts
      .filter((alert) => !alert.resolved)
      .map((alert) => ({
        id: alert.id,
        message: alert.message,
        severity: alert.severity?.toUpperCase() === "HIGH" ? "HIGH" : "MEDIUM",
        source: "system",
        createdAt: alert.createdAt,
      }));
    return [...derivedAlerts, ...systemAlerts].slice(0, 5);
  }, [alerts, derivedAlerts]);

  async function handleCreateLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!token) {
      return;
    }
    try {
      await createBankLine(token, formState);
      const refreshed = await fetchBankLines(token);
      setBankLines(refreshed.lines);
    } catch (err) {
      console.error(err);
      setFormError("Unable to create ledger entry");
    }
  }

  if (!token) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header>
        <h1 style={pageTitleStyle}>Compliance Control Room</h1>
        <p style={pageSubtitleStyle}>
          Snapshot of PAYGW and GST obligations, plus the ledger evidence we share with the ATO to prove funds are secured.
        </p>
      </header>

      {loading && <div style={infoTextStyle}>Loading APGMS control panel…</div>}
      {error && <div style={errorTextStyle}>{error}</div>}

      {obligations && !error && (
        <>
          {virtualBalance && (
            <section style={virtualBalanceSectionStyle}>
              <div style={virtualBalanceHeaderStyle}>
                <div>
                  <h2 style={designatedTitleStyle}>Virtual Balance</h2>
                  <p style={designatedSubtitleStyle}>
                    Actual cash vs. tax reserved funds derived from GST/PAYGW evidence. Tier: {tier ?? "Monitor"}
                  </p>
                </div>
              </div>
              <div style={virtualBalanceGridStyle}>
                <VirtualBalanceMetric
                  label="Actual cash on hand"
                  value={virtualBalance.actualBalance}
                  description="Sum of PAYGW and GST designated ledgers"
                  testId="balance-actual"
                />
                <VirtualBalanceMetric
                  label="Tax reserved"
                  value={virtualBalance.taxReserved}
                  description="GST collected + PAYGW withheld"
                  testId="balance-tax"
                />
                <VirtualBalanceMetric
                  label="Discretionary cash"
                  value={virtualBalance.discretionaryBalance}
                  description="Funds safe to deploy after tax reserves"
                  emphasize={virtualBalance.discretionaryBalance < 0}
                  testId="balance-discretionary"
                />
              </div>
            </section>
          )}

          <section style={summaryGridStyle}>
            <ObligationSummary
              title="PAYGW"
              required={obligations.paygw.required}
              secured={obligations.paygw.secured}
              shortfall={obligations.paygw.shortfall}
              status={obligations.paygw.status}
            />
            <ObligationSummary
              title="GST"
              required={obligations.gst.required}
              secured={obligations.gst.secured}
              shortfall={obligations.gst.shortfall}
              status={obligations.gst.status}
            />
            <div style={nextBasCardStyle}>
              <span style={infoLabelStyle}>Next BAS Due</span>
              <div style={nextBasValueStyle}>{nextBasDueDisplay}</div>
              <p style={nextBasDescriptionStyle}>
                APGMS blocks the ATO transfer if the holding accounts are short so you can remediate early.
              </p>
            </div>
          </section>

          {prediction && (
            <section style={predictionCardStyle}>
              <div>
                <h2 style={designatedTitleStyle}>45-day BAS forecast</h2>
                <p style={designatedSubtitleStyle}>
                  Rolling 3-month averages projected forward. Confidence is derived from recent volatility.
                </p>
              </div>
              <div style={predictionStatsRowStyle}>
                <PredictionStat label="GST estimate" value={prediction.prediction.gstEstimate} />
                <PredictionStat label="PAYGW estimate" value={prediction.prediction.paygwEstimate} />
                <div style={predictionConfidenceStyle}>
                  <dt style={metricLabelStyle}>Confidence</dt>
                  <dd style={metricValueStyle}>{percentFormatter.format(prediction.prediction.confidence)}</dd>
                </div>
              </div>
            </section>
          )}

          <section style={alertCenterStyle}>
            <div>
              <h2 style={designatedTitleStyle}>Alert center</h2>
              <p style={designatedSubtitleStyle}>
                Early warnings for discretionary cash and BAS deadlines. Live alerts originate from auto-policy checks.
              </p>
            </div>
            {alertCards.length === 0 ? (
              <div style={infoTextStyle}>All clear — no outstanding alerts.</div>
            ) : (
              <ul style={alertListStyle}>
                {alertCards.map((alert) => (
                  <li key={alert.id} style={alertItemStyle}>
                    <span style={severityBadgeStyle(alert.severity)}>{alert.severity}</span>
                    <div>
                      <div style={alertMessageStyle}>{alert.message}</div>
                      <div style={designatedCaptionStyle}>
                        {alert.source === "system" ? "Escalation" : "Derived"}
                        {alert.createdAt ? ` • ${new Date(alert.createdAt).toLocaleString()}` : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(designated || designatedError) && (
            <section style={designatedSectionStyle}>
              <div style={designatedHeaderStyle}>
                <h2 style={designatedTitleStyle}>Designated Accounts</h2>
                <p style={designatedSubtitleStyle}>
                  PAYGW and GST cash is ringfenced in inbound-only accounts. Shortfalls appear here before BAS lodgment.
                </p>
              </div>
              {designatedError && <div style={errorTextStyle}>{designatedError}</div>}
              {!designated && !designatedError && (
                <div style={infoTextStyle}>Loading designated account balances...</div>
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
                  Every protected withdrawal or capture is audited. Shortfall right now: <strong>{currencyFormatter.format(paygwGap + gstGap)} total</strong>.
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
                <div style={{ ...infoTextStyle, padding: "12px 0" }}>No ledger activity recorded yet.</div>
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
                  <span>Amount</span>
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
              <button type="submit" style={submitButtonStyle}>
                Add ledger entry
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

function VirtualBalanceMetric({
  label,
  value,
  description,
  emphasize,
  testId,
}: {
  label: string;
  value: number;
  description: string;
  emphasize?: boolean;
  testId: string;
}) {
  return (
    <div style={virtualMetricStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <div
        data-testid={testId}
        style={{
          fontSize: "32px",
          fontWeight: 700,
          color: emphasize ? "#b91c1c" : "#111827",
        }}
      >
        {currencyFormatter.format(value)}
      </div>
      <p style={designatedCaptionStyle}>{description}</p>
    </div>
  );
}

function PredictionStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={predictionStatStyle}>
      <dt style={metricLabelStyle}>{label}</dt>
      <dd style={metricValueStyle}>{currencyFormatter.format(value)}</dd>
    </div>
  );
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
  const shortfall = Math.max(0, required - balance);
  const status =
    account === null
      ? "Not provisioned"
      : shortfall <= 0
        ? "Sufficient"
        : `Shortfall ${currencyFormatter.format(shortfall)}`;
  const palette = designatedStatusPalette(
    account === null ? "missing" : shortfall <= 0 ? "ready" : "short",
  );
  return (
    <div style={designatedCardStyle}>
      <div style={designatedCardHeaderStyle}>
        <h3 style={designatedCardTitleStyle}>{title}</h3>
        <span
          style={{
            ...designationStatusChipBase,
            backgroundColor: palette.background,
            color: palette.text,
          }}
        >
          {status}
        </span>
      </div>
      <div style={designatedBalanceStyle}>{currencyFormatter.format(balance)}</div>
      <div style={designatedCaptionStyle}>Required this BAS: {currencyFormatter.format(required)}</div>
      <div>
        <div style={designatedTransfersTitleStyle}>Last transfers</div>
        {account && account.transfers.length > 0 ? (
          <ul style={designatedTransfersListStyle}>
            {account.transfers.map((transfer) => (
              <li key={transfer.id} style={designatedTransferItemStyle}>
                <div>{currencyFormatter.format(transfer.amount)}</div>
                <div style={designatedTransferMetaStyle}>
                  {transfer.source} • {new Date(transfer.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={infoTextStyle}>
            {account ? "No transfers recorded yet." : "Account has not been provisioned in this demo."}
          </div>
        )}
      </div>
    </div>
  );
}

function ObligationSummary(props: {
  title: string;
  required: number;
  secured: number;
  shortfall: number;
  status: string;
}) {
  const palette = statusPalette(props.status);
  return (
    <div style={obligationCardStyle}>
      <div style={obligationHeaderStyle}>
        <h3 style={obligationTitleStyle}>{props.title}</h3>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: palette.background,
            color: palette.text,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {props.status}
        </span>
      </div>
      <dl style={metricsListStyle}>
        <Metric label="Required" value={props.required} />
        <Metric label="Secured" value={props.secured} />
        <Metric label="Shortfall" value={props.shortfall} emphasize={props.shortfall > 0} />
      </dl>
    </div>
  );
}

function Metric({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div style={metricRowStyle}>
      <dt style={metricLabelStyle}>{label}</dt>
      <dd
        style={{
          ...metricValueStyle,
          color: emphasize ? "#b91c1c" : metricValueStyle.color,
        }}
      >
        {currencyFormatter.format(value ?? 0)}
      </dd>
    </div>
  );
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  margin: 0,
  color: "#0f172a",
};

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "#475569",
  marginTop: "8px",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#475569",
};

const errorTextStyle: React.CSSProperties = {
  ...infoTextStyle,
  color: "#b91c1c",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "24px",
};

const obligationCardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  border: "1px solid #e2e8f0",
};

const obligationHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};

const obligationTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  margin: 0,
};

const metricsListStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  margin: 0,
};

const metricRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#94a3b8",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "#0f172a",
};

const nextBasCardStyle: React.CSSProperties = {
  ...obligationCardStyle,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#94a3b8",
};

const nextBasValueStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
};

const nextBasDescriptionStyle: React.CSSProperties = {
  color: "#475569",
  margin: 0,
};

const designatedSectionStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "24px",
  border: "1px solid #e2e8f0",
};

const designatedHeaderStyle: React.CSSProperties = {
  marginBottom: "20px",
};

const designatedTitleStyle: React.CSSProperties = {
  fontSize: "20px",
  margin: 0,
};

const designatedSubtitleStyle: React.CSSProperties = {
  marginTop: "8px",
  color: "#475569",
};

const designatedGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "20px",
};

const designatedCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "20px",
};

const designatedCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};

const designatedCardTitleStyle: React.CSSProperties = {
  margin: 0,
};

const designationStatusChipBase: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  padding: "4px 10px",
  borderRadius: "999px",
};

const designatedBalanceStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 700,
};

const designatedCaptionStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#64748b",
};

const designatedTransfersTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  marginTop: "12px",
};

const designatedTransfersListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: "8px",
};

const designatedTransferItemStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "8px",
};

const designatedTransferMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
};

const ledgerCardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "24px",
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: "16px",
};

const ledgerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const ledgerTitleStyle: React.CSSProperties = {
  fontSize: "20px",
  margin: 0,
};

const ledgerSubtitleStyle: React.CSSProperties = {
  marginTop: "8px",
  color: "#475569",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: "14px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "14px",
};

const ledgerFormStyle: React.CSSProperties = {
  borderTop: "1px solid #e2e8f0",
  paddingTop: "16px",
  display: "grid",
  gap: "12px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px",
};

const formLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  fontSize: "13px",
  color: "#475569",
};

const formInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5f5",
  borderRadius: "6px",
  padding: "8px",
};

const submitButtonStyle: React.CSSProperties = {
  justifySelf: "start",
  backgroundColor: "#0b5fff",
  border: "none",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: "8px",
  cursor: "pointer",
};

const virtualBalanceSectionStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "24px",
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: "16px",
};

const virtualBalanceHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const virtualBalanceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const virtualMetricStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "16px",
  background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
};

const predictionCardStyle: React.CSSProperties = {
  ...virtualBalanceSectionStyle,
};

const predictionStatsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
};

const predictionStatStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "16px",
};

const predictionConfidenceStyle: React.CSSProperties = {
  ...predictionStatStyle,
};

const alertCenterStyle: React.CSSProperties = {
  ...virtualBalanceSectionStyle,
};

const alertListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: "12px",
};

const alertItemStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "12px",
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
};

const alertMessageStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#111827",
};

function severityBadgeStyle(level: DerivedAlert["severity"]): React.CSSProperties {
  const palette = {
    HIGH: { background: "#fee2e2", color: "#b91c1c" },
    MEDIUM: { background: "#fef3c7", color: "#b45309" },
    LOW: { background: "#dcfce7", color: "#166534" },
  } as const;
  return {
    alignSelf: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    backgroundColor: palette[level].background,
    color: palette[level].color,
  };
}

const statusPalette = (status: string) => {
  if (status.toUpperCase() === "READY") {
    return { background: "#dcfce7", text: "#166534" };
  }
  return { background: "#fee2e2", text: "#b91c1c" };
};

const designatedStatusPalette = (status: "ready" | "short" | "missing") => {
  switch (status) {
    case "ready":
      return { background: "#dcfce7", text: "#166534" };
    case "missing":
      return { background: "#e2e8f0", text: "#475569" };
    default:
      return { background: "#fee2e2", text: "#b91c1c" };
  }
};
