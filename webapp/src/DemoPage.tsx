import React, { useMemo, useState } from "react";
import {
  compileDemoBas,
  generateDemoBankLines,
  runDemoPayroll,
  seedDemoOrg,
} from "./api";
import { getToken } from "./auth";
import { ActivityRail, ErrorState, KpiRibbon, SkeletonBlock, StatusChip } from "./components/UI";

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

type SeedState = {
  busy: boolean;
  summary?: Record<string, unknown>;
  error?: string;
  lastRun?: string;
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
  const [seedState, setSeedState] = useState<SeedState>({ busy: false });

  const bankSection = useMemo(() => {
    if (!bankState.summary) return null;
    return <pre style={preStyle}>{bankState.summary}</pre>;
  }, [bankState.summary]);

  const payrollSection = useMemo(() => {
    if (!payrollState.summary) return null;
    return <pre style={preStyle}>{payrollState.summary}</pre>;
  }, [payrollState.summary]);

  const basSection = useMemo(() => {
    if (!basState.summary) return null;
    return <pre style={preStyle}>{basState.summary}</pre>;
  }, [basState.summary]);

  const seedKpis = useMemo(() => {
    if (!seedState.summary) return [];
    return [
      { title: "Bank lines", value: String(seedState.summary.bankLines ?? "-"), tone: "success" as const },
      { title: "Payroll runs", value: String(seedState.summary.payrollRuns ?? "-"), tone: "neutral" as const },
      { title: "GST days", value: String(seedState.summary.gstDays ?? "-"), tone: "neutral" as const },
      { title: "BAS periods", value: String(seedState.summary.basPeriods ?? "-"), tone: "neutral" as const },
      { title: "Alerts", value: String(seedState.summary.alerts ?? "-"), tone: "warning" as const },
      { title: "Evidence packs", value: String(seedState.summary.evidenceArtifacts ?? "-"), tone: "success" as const },
    ];
  }, [seedState.summary]);

  const activityItems = useMemo(
    () => [
      {
        title: "Seed demo org",
        status: seedState.busy ? "loading" : seedState.summary ? "success" : seedState.error ? "error" : "idle",
        detail: seedState.error ?? "Creates evidence, BAS periods, feeds, and users",
        meta: seedState.lastRun ?? undefined,
      },
      {
        title: "Generate bank feed",
        status: bankState.busy ? "loading" : bankState.summary ? "success" : bankState.error ? "error" : "idle",
        detail: bankState.error ?? `Days back: ${demoDays}, intensity ${demoIntensity}`,
      },
      {
        title: "Run payroll",
        status: payrollState.busy ? "loading" : payrollState.summary ? "success" : payrollState.error ? "error" : "idle",
        detail: payrollState.error ?? (includeBank ? "Includes bank line" : "Payroll only"),
      },
      {
        title: "Compile BAS",
        status: basState.busy ? "loading" : basState.summary ? "success" : basState.error ? "error" : "idle",
        detail: basState.error ?? `Period ${basPeriod.year}-${basPeriod.month.toString().padStart(2, "0")}`,
      },
    ],
    [
      bankState.busy,
      bankState.error,
      bankState.summary,
      demoDays,
      demoIntensity,
      payrollState.busy,
      payrollState.error,
      payrollState.summary,
      includeBank,
      basState.busy,
      basState.error,
      basState.summary,
      basPeriod.year,
      basPeriod.month,
      seedState.busy,
      seedState.error,
      seedState.summary,
      seedState.lastRun,
    ],
  );

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
        summary: JSON.stringify(response, null, 2),
        rows: response.rows,
      });
    } catch (err) {
      console.error(err);
      setBankState({ busy: false, error: "Unable to generate bank feed" });
    }
  }

  async function handleRunPayroll() {
    if (!token) return;
    setPayrollState({ busy: true });
    try {
      const response = await runDemoPayroll(token, {
        includeBankLines: includeBank,
      });
      setPayrollState({ busy: false, summary: JSON.stringify(response, null, 2) });
    } catch (err) {
      console.error(err);
      setPayrollState({ busy: false, error: "Unable to run demo payroll" });
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
      setBasState({ busy: false, summary: JSON.stringify(response, null, 2) });
    } catch (err) {
      console.error(err);
      setBasState({ busy: false, error: "Unable to compile demo BAS" });
    }
  }

  async function handleSeed() {
    if (!token) return;
    setSeedState({ busy: true });
    try {
      const response = await seedDemoOrg(token);
      setSeedState({
        busy: false,
        summary: response.summary,
        lastRun: new Date().toLocaleString(),
      });
    } catch (err) {
      console.error(err);
      setSeedState({ busy: false, error: "Unable to seed demo org" });
    }
  }

  if (!token) return null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h1 style={pageTitleStyle}>Demo mode</h1>
        <p style={pageSubtitleStyle}>
          Generate demo bank feeds, payroll runs, and BAS compiles to populate the dashboard with sample data.
        </p>
      </header>

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Full demo seed</h2>
            <p style={sectionSubtitleStyle}>
              Create the full demo organisation with history, alerts, evidence, and security users.
            </p>
          </div>
          <button type="button" className="app-button" onClick={handleSeed} disabled={seedState.busy}>
            {seedState.busy ? "Seeding demo data..." : "Generate demo org"}
          </button>
        </div>
        {seedState.busy && <SkeletonBlock width="100%" height={48} />}
        {seedState.error && <ErrorState message={seedState.error} />}
        {seedKpis.length > 0 && <KpiRibbon items={seedKpis} columns={3} />}
      </section>

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Demo control rail</h2>
            <p style={sectionSubtitleStyle}>Track the status of each demo data generator.</p>
          </div>
          <StatusChip tone="neutral">Live preview</StatusChip>
        </div>
        <ActivityRail items={activityItems} />
      </section>

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Demo bank feed</h2>
            <p style={sectionSubtitleStyle}>Replay a position/day feed that locks PAYGW & GST capture for the demo organisation.</p>
          </div>
          <StatusChip tone="neutral">Inbound only</StatusChip>
        </div>
        <div style={gridTwoColumns}>
          <label style={labelStyle}>
            <span>Days back</span>
            <input
              type="number"
              min={1}
              max={30}
              value={demoDays}
              onChange={(e) => setDemoDays(Number(e.target.value))}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Intensity</span>
            <select
              value={demoIntensity}
              onChange={(e) => setDemoIntensity(e.target.value as any)}
              style={inputStyle}
            >
              <option value="low">Low</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="app-button" onClick={handleGenerateBankFeed} disabled={bankState.busy}>
            {bankState.busy ? "Generating..." : "Generate demo bank feed"}
          </button>
        </div>
        {bankState.busy && <SkeletonBlock width="100%" height={60} />}
        {bankState.error && <ErrorState message={bankState.error} />}
        {bankSection}
      </section>

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Demo payroll run</h2>
            <p style={sectionSubtitleStyle}>Create a payroll run and optionally mirror it in the bank feed.</p>
          </div>
          <StatusChip tone="neutral">Demo org</StatusChip>
        </div>
        <label style={checkboxStyle}>
          <input
            type="checkbox"
            checked={includeBank}
            onChange={(e) => setIncludeBank(e.target.checked)}
          />
          Create linked bank line
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="app-button" onClick={handleRunPayroll} disabled={payrollState.busy}>
            {payrollState.busy ? "Running..." : "Run demo payroll"}
          </button>
        </div>
        {payrollState.busy && <SkeletonBlock width="100%" height={40} />}
        {payrollState.error && <ErrorState message={payrollState.error} />}
        {payrollSection}
      </section>

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Demo BAS compile</h2>
            <p style={sectionSubtitleStyle}>Compile a mock BAS report for the chosen period.</p>
          </div>
          <StatusChip tone="neutral">Preview only</StatusChip>
        </div>
        <div style={gridTwoColumns}>
          <label style={labelStyle}>
            <span>Year</span>
            <input
              type="number"
              value={basPeriod.year}
              onChange={(e) => setBasPeriod((prev) => ({ ...prev, year: Number(e.target.value) }))}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Month</span>
            <input
              type="number"
              min={1}
              max={12}
              value={basPeriod.month}
              onChange={(e) => setBasPeriod((prev) => ({ ...prev, month: Number(e.target.value) }))}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="app-button" onClick={handleCompileBas} disabled={basState.busy}>
            {basState.busy ? "Compiling..." : "Compile demo BAS"}
          </button>
        </div>
        {basState.busy && <SkeletonBlock width="100%" height={40} />}
        {basState.error && <ErrorState message={basState.error} />}
        {basSection}
      </section>
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

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "10px",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
};

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
  margin: 0,
};

const gridTwoColumns: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  fontSize: "14px",
  color: "#111827",
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  fontSize: "14px",
};

const checkboxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: "14px",
};

const preStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  fontSize: 12,
  overflow: "auto",
};
