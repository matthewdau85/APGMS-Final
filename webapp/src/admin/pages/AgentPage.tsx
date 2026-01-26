// ASCII only
import React, { useEffect, useState } from "react";
import { createAgentRun, fetchAgentRunById, fetchAgentRuns } from "../adminApi";

type Run = {
  id: string;
  type: string;
  status: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  resultSummary?: any;
  exitCode?: number;
  lastLogLines?: string[];
};

export function AgentPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const out = await fetchAgentRuns();
      setRuns(out.runs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function pollRun(id: string) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const out = await fetchAgentRunById(id);
      const run = out?.run as Run;
      setActiveRun(run);
      if (run.status === "succeeded" || run.status === "failed") return run;
    }
    throw new Error("Timed out waiting for run completion");
  }

  async function start(job: "smoke" | "demo-stress" | "agent-suite") {
    setError(null);
    setRunning(true);
    try {
      const out = await createAgentRun(job, { invokedFrom: "admin_ui" });
      const id = String(out.runId || out.run?.id || "");
      if (!id) throw new Error("Run did not return an id");
      const final = await pollRun(id);
      await load();
      return final;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="apgms-page">
      <div className="apgms-pageHeader">
        <div>
          <div className="apgms-h1">Agent</div>
          <div className="apgms-subtle">
            Internal orchestration and automation runner for the operator. Admin-only. Not customer-facing.
          </div>
        </div>

        <div className="apgms-row">
          <button className="apgms-btn apgms-btnSmall" onClick={() => void load()} disabled={loading || running}>
            Refresh
          </button>
          <button className="apgms-btn apgms-btnSmall" onClick={() => void start("smoke")} disabled={running}>
            {running ? "Running..." : "Run Smoke"}
          </button>
          <button className="apgms-btn apgms-btnSmall apgms-btnPrimary" onClick={() => void start("demo-stress")} disabled={running}>
            {running ? "Running..." : "Run Demo Stress"}
          </button>
          <button className="apgms-btn apgms-btnSmall" onClick={() => void start("agent-suite")} disabled={running}>
            {running ? "Running..." : "Run Agent Suite"}
          </button>
        </div>
      </div>

      {error && <div className="apgms-error">{error}</div>}

      {activeRun && (
        <div className="apgms-card">
          <div className="apgms-cardHeader">
            <div className="apgms-cardTitle">Latest run</div>
            <div className="apgms-badge">{activeRun.status}</div>
          </div>
          <div className="apgms-stack">
            <div><strong>ID:</strong> {activeRun.id}</div>
            <div><strong>Type:</strong> {activeRun.type}</div>
            {activeRun.startedAt && <div><strong>Started:</strong> {activeRun.startedAt}</div>}
            {activeRun.finishedAt && <div><strong>Finished:</strong> {activeRun.finishedAt}</div>}
            {activeRun.exitCode !== undefined && <div><strong>Exit code:</strong> {String(activeRun.exitCode)}</div>}
            {activeRun.resultSummary && (
              <pre className="apgms-pre">{JSON.stringify(activeRun.resultSummary, null, 2)}</pre>
            )}
            {Array.isArray(activeRun.lastLogLines) && activeRun.lastLogLines.length > 0 && (
              <pre className="apgms-pre">{activeRun.lastLogLines.join("\n")}</pre>
            )}
          </div>
        </div>
      )}

      <div className="apgms-card">
        <div className="apgms-cardHeader">
          <div className="apgms-cardTitle">Recent runs</div>
          <div className="apgms-badge">Admin only</div>
        </div>

        {loading ? (
          <div className="apgms-subtle">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="apgms-subtle">No runs yet.</div>
        ) : (
          <div className="apgms-tableWrap">
            <table className="apgms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Queued</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td><code>{r.id.slice(0, 8)}</code></td>
                    <td>{r.type}</td>
                    <td>{r.status}</td>
                    <td>{r.queuedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
