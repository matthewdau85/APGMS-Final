import React, { useEffect, useMemo, useState } from "react";
import { fetchBankLines, fetchCurrentObligations, createBankLine } from "./api";
import { getToken } from "./auth";

type Obligations = Awaited<ReturnType<typeof fetchCurrentObligations>>;
type BankLine = Awaited<ReturnType<typeof fetchBankLines>>["lines"][number];

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

export default function DashboardPage() {
  const token = getToken();
  const [obligations, setObligations] = useState<Obligations | null>(null);
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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

    (async () => {
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
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const paygwGap = useMemo(() => {
    if (!obligations) return 0;
    return Math.max(0, obligations.paygw.required - obligations.paygw.secured);
  }, [obligations]);

  const gstGap = useMemo(() => {
    if (!obligations) return 0;
    return Math.max(0, obligations.gst.required - obligations.gst.secured);
  }, [obligations]);

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
              <div style={nextBasValueStyle}>
                {new Date(obligations.nextBasDue).toLocaleString()}
              </div>
              <p style={nextBasDescriptionStyle}>
                APGMS blocks the ATO transfer if the holding accounts are short so you can remediate early.
              </p>
            </div>
          </section>

          <section style={ledgerCardStyle}>
            <div style={ledgerHeaderStyle}>
              <div>
                <h2 style={ledgerTitleStyle}>Bank Ledger Evidence</h2>
                <p style={ledgerSubtitleStyle}>
                  Every protected withdrawal or capture is audited. Shortfall right now:{" "}
                  <strong>
                    {currencyFormatter.format(paygwGap + gstGap)} total
                  </strong>
                  .
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
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </label>
                <label style={formLabelStyle}>
                  <span>Amount</span>
                  <input
                    style={formInputStyle}
                    value={formState.amount}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, amount: e.target.value }))
                    }
                  />
                </label>
                <label style={formLabelStyle}>
                  <span>Payee</span>
                  <input
                    style={formInputStyle}
                    value={formState.payee}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, payee: e.target.value }))
                    }
                  />
                </label>
                <label style={formLabelStyle}>
                  <span>Description</span>
                  <input
                    style={formInputStyle}
                    value={formState.desc}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, desc: e.target.value }))
                    }
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

function statusPalette(status: string) {
  switch (status.toUpperCase()) {
    case "READY":
      return { background: "rgba(16, 185, 129, 0.12)", text: "#047857" };
    case "SHORTFALL":
      return { background: "rgba(239, 68, 68, 0.12)", text: "#b91c1c" };
    default:
      return { background: "rgba(251, 191, 36, 0.18)", text: "#92400e" };
  }
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 700,
  marginBottom: "8px",
};

const pageSubtitleStyle: React.CSSProperties = {
  color: "#4b5563",
  margin: 0,
  fontSize: "14px",
  maxWidth: "680px",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const obligationCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const obligationHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};

const obligationTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
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
  alignItems: "baseline",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#6b7280",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#111827",
};

const nextBasCardStyle: React.CSSProperties = {
  backgroundColor: "#0b5fff",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  display: "grid",
  gap: "8px",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  opacity: 0.85,
};

const nextBasValueStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
};

const nextBasDescriptionStyle: React.CSSProperties = {
  fontSize: "13px",
  margin: 0,
  opacity: 0.85,
  lineHeight: 1.5,
};

const ledgerCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "24px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "20px",
};

const ledgerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: "12px",
};

const ledgerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 600,
};

const ledgerSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: "#4b5563",
  fontSize: "14px",
  maxWidth: "560px",
  lineHeight: 1.5,
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  minWidth: "640px",
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
  borderTop: "1px solid #e2e8f0",
  paddingTop: "20px",
  display: "grid",
  gap: "16px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const formLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  color: "#1f2937",
};

const formInputStyle: React.CSSProperties = {
  padding: "10px",
  fontSize: "14px",
  borderRadius: "6px",
  border: "1px solid #cbd5f5",
};

const submitButtonStyle: React.CSSProperties = {
  justifySelf: "flex-start",
  backgroundColor: "#111827",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "10px 16px",
  fontSize: "14px",
  cursor: "pointer",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#b91c1c",
};
