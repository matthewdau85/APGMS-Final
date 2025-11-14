import React, { useMemo, useState } from "react";
import {
  compileDemoBas,
  generateDemoBankLines,
  runDemoPayroll,
} from "./api";
import { getToken } from "./auth";

type BankFeedState = {
  busy: boolean;
  summary?: string;
  rows?: Array<{ id: string; amount: number; date: string }>;
  error?: string;
};

type PayrollState = {
  busy: boolean;
  summary?: string;
  error?: string;
};

type BasState = {
  busy: boolean;
  summary?: string;
  error?: string;
};

export default function DemoPage() {
  const token = getToken();
  const [bankState, setBankState] = useState<BankFeedState>({ busy: false });
  const [demoDays, setDemoDays] = useState(7);
  const [demoIntensity, setDemoIntensity] = useState<"low" | "high">("low");
  const [payrollState, setPayrollState] = useState<PayrollState>({ busy: false });
  const [includeBank, setIncludeBank] = useState(true);
  const [basState, setBasState] = useState<BasState>({ busy: false });
  const [basPeriod, setBasPeriod] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });

  const bankSection = useMemo(() => {
    if (!bankState.summary) return null;
    return (
      <pre style={preStyle}>{bankState.summary}</pre>
    );
  }, [bankState.summary]);

  const payrollSection = useMemo(() => {
    if (!payrollState.summary) return null;
    return <pre style={preStyle}>{payrollState.summary}</pre>;
  }, [payrollState.summary]);

  const basSection = useMemo(() => {
    if (!basState.summary) return null;
    return <pre style={preStyle}>{basState.summary}</pre>;
  }, [basState.summary]);

  async function handleGenerateBankFeed() {
    if (!token) return;
    setBankState({ busy: true });
    try {
      const response = await generateDemoBankLines(token, {
        daysBack: demoDays,
        intensity: demoIntensity,
      });
      setBankState({
        busy: false,
        summary: `${response.note}\nGenerated ${response.generated} entries (${response.intensity})\nRange: ${response.range}`,
        rows: response.rows,
      });
    } catch (error) {
      setBankState({
        busy: false,
        error: "Unable to generate demo bank feed",
      });
    }
  }

  async function handleRunPayroll() {
    if (!token) return;
    setPayrollState({ busy: true });
    try {
      const response = await runDemoPayroll(token, {
        includeBankLines: includeBank,
      });
      setPayrollState({
        busy: false,
        summary: `${response.note}\nPAYGW secured: ${response.totalPaygWithheld.toFixed(2)}\nPayslips: ${response.payslips}\npayRunId: ${response.payRunId}`,
      });
    } catch (error) {
      setPayrollState({
        busy: false,
        error: "Unable to run demo payroll",
      });
    }
  }

  async function handleCompileBas() {
    if (!token) return;
    setBasState({ busy: true });
    try {
      const response = await compileDemoBas(token, {
        year: basPeriod.year,
        month: basPeriod.month,
      });
      setBasState({
        busy: false,
        summary: `${response.note}\nPeriod: ${response.period.year}-${response.period.month}\nGST Collected ${response.gstCollected}\nGST Credits ${response.gstCredits}\nNet GST ${response.netGst}\nPAYGW ${response.paygWithheld}\nBank lines: ${response.bankLines}\nPayslips: ${response.payslips}`,
      });
    } catch (error) {
      setBasState({
        busy: false,
        error: "Unable to compile demo BAS",
      });
    }
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section style={cardStyle}>
        <h2 style={headingStyle}>Demo bank feed</h2>
        <p style={descriptionStyle}>
          Replay a position/day feed that locks PAYGW & GST capture for the demo organisation.
        </p>
        <div style={controlsRow}>
          <label>
            Days back
            <input
              type="number"
              value={demoDays}
              onChange={(event) => setDemoDays(Number(event.target.value))}
              min={1}
              max={30}
              style={inputStyle}
            />
          </label>
          <label>
            Intensity
            <select
              value={demoIntensity}
              onChange={(event) => setDemoIntensity(event.target.value as "low" | "high")}
              style={inputStyle}
            >
              <option value="low">Low</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <button onClick={handleGenerateBankFeed} disabled={bankState.busy} style={buttonStyle}>
          {bankState.busy ? "Generating…" : "Generate demo bank feed"}
        </button>
        {bankState.error && <div style={errorStyle}>{bankState.error}</div>}
        {bankSection}
      </section>

      <section style={cardStyle}>
        <h2 style={headingStyle}>Demo payroll run</h2>
        <p style={descriptionStyle}>Create a payroll run and optionally mirror it in the bank feed.</p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ fontSize: "13px" }}>
            <input
              type="checkbox"
              checked={includeBank}
              onChange={(event) => setIncludeBank(event.target.checked)}
            />{" "}
            Create linked bank line
          </label>
        </div>
        <button onClick={handleRunPayroll} disabled={payrollState.busy} style={buttonStyle}>
          {payrollState.busy ? "Running…" : "Run demo payroll"}
        </button>
        {payrollState.error && <div style={errorStyle}>{payrollState.error}</div>}
        {payrollSection}
      </section>

      <section style={cardStyle}>
        <h2 style={headingStyle}>Demo BAS compile</h2>
        <p style={descriptionStyle}>Compile a mock BAS report for the chosen period.</p>
        <div style={controlsRow}>
          <label>
            Year
            <input
              type="number"
              value={basPeriod.year}
              onChange={(event) => setBasPeriod((prev) => ({ ...prev, year: Number(event.target.value) }))}
              style={inputStyle}
            />
          </label>
          <label>
            Month
            <input
              type="number"
              min={1}
              max={12}
              value={basPeriod.month}
              onChange={(event) => setBasPeriod((prev) => ({ ...prev, month: Number(event.target.value) }))}
              style={inputStyle}
            />
          </label>
        </div>
        <button onClick={handleCompileBas} disabled={basState.busy} style={buttonStyle}>
          {basState.busy ? "Compiling…" : "Compile demo BAS"}
        </button>
        {basState.error && <div style={errorStyle}>{basState.error}</div>}
        {basSection}
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 1px 4px rgba(31, 41, 55, 0.08)",
  border: "1px solid #e2e8f0",
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  marginBottom: "6px",
};

const descriptionStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  marginBottom: "12px",
};

const controlsRow: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "12px",
};

const inputStyle: React.CSSProperties = {
  marginTop: "4px",
  width: "120px",
  padding: "8px",
};

const buttonStyle: React.CSSProperties = {
  marginTop: "8px",
  padding: "10px 14px",
  borderRadius: "6px",
  border: "none",
  backgroundColor: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  marginTop: "8px",
};

const preStyle: React.CSSProperties = {
  marginTop: "12px",
  backgroundColor: "#0b5fff0f",
  padding: "12px",
  borderRadius: "6px",
  fontSize: "13px",
  color: "#0b5fff",
};
