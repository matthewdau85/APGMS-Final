import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { useTierTuning } from "../hooks/useTierTuning.js";
import type { TierCheckResult } from "../api.js";

export type TierEscalationPanelProps = {
  baseUrl?: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function ResultTable({ results }: { results: TierCheckResult[] }) {
  if (results.length === 0) {
    return <p style={{ marginTop: "0.5rem", color: "#5f6b7c" }}>No tier checks have run yet.</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
      <thead>
        <tr>
          <th style={headerCell}>Org</th>
          <th style={headerCell}>Status</th>
          <th style={headerCell}>Last Run</th>
          <th style={headerCell}>Next Run</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result) => (
          <tr key={result.orgId} style={{ borderTop: "1px solid #d5dbe4" }}>
            <td style={cell}>{result.orgId}</td>
            <td style={cell}>{result.skipped ? result.reason ?? "skipped" : "updated"}</td>
            <td style={cell}>{formatDate(result.schedule.lastRunAt)}</td>
            <td style={cell}>{formatDate(result.schedule.nextRunAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const headerCell: CSSProperties = {
  textAlign: "left",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#4a5568",
  padding: "0.25rem 0.5rem",
};

const cell: CSSProperties = {
  fontSize: "0.85rem",
  padding: "0.35rem 0.5rem",
};

export function TierEscalationPanel({ baseUrl = "" }: TierEscalationPanelProps) {
  const { config, loading, error, save, runTierCheck, results } = useTierTuning(baseUrl);
  const [marginPercent, setMarginPercent] = useState("10");
  const [frequencyHours, setFrequencyHours] = useState("24");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setMarginPercent(String(Math.round(config.marginPercent * 1000) / 10));
      setFrequencyHours(String(config.schedule.defaultFrequencyHours));
    }
  }, [config]);

  const saveDisabled = useMemo(() => busy || loading, [busy, loading]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await save({
        marginPercent: Number(marginPercent) / 100,
        schedule: { defaultFrequencyHours: Number(frequencyHours) },
      });
      setMessage("Tier tuning saved.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await runTierCheck({ force: true });
      setMessage(`Triggered ${outcome.length} orgs.`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={panel}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>Tier escalation tuning</h2>
        <p style={{ margin: 0, color: "#5f6b7c" }}>
          Configure coverage margins and the automation schedule that feeds tier alerts.
        </p>
      </header>
      {error && <p style={{ color: "#d03801" }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <label style={fieldLabel}>
          Margin %
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={marginPercent}
            onChange={(event) => setMarginPercent(event.target.value)}
            style={input}
          />
        </label>
        <label style={fieldLabel}>
          Tier check frequency (hours)
          <input
            type="number"
            min={1}
            max={168}
            step={1}
            value={frequencyHours}
            onChange={(event) => setFrequencyHours(event.target.value)}
            style={input}
          />
        </label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
          <button type="submit" disabled={saveDisabled} style={button}>
            Save
          </button>
          <button type="button" onClick={handleRun} disabled={busy} style={{ ...button, background: "#2f855a" }}>
            Force tier check
          </button>
        </div>
      </form>
      {message && <p style={{ color: "#2563eb", marginTop: "0.5rem" }}>{message}</p>}
      <ResultTable results={results} />
    </section>
  );
}

const panel: CSSProperties = {
  border: "1px solid #d5dbe4",
  borderRadius: "8px",
  padding: "1rem",
  background: "#fff",
};

const fieldLabel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: "0.9rem",
  color: "#2d3748",
  gap: "0.25rem",
};

const input: CSSProperties = {
  padding: "0.4rem 0.5rem",
  borderRadius: "4px",
  border: "1px solid #cbd5e0",
  minWidth: "8rem",
};

const button: CSSProperties = {
  padding: "0.45rem 0.9rem",
  borderRadius: "4px",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
};
