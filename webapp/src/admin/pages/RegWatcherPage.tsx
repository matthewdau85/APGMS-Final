// ASCII only
import React, { useEffect, useState } from "react";
import { fetchRegWatcherStatus, runRegWatcher } from "../adminApi";

export function RegWatcherPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const out = await fetchRegWatcherStatus();
      setStatus(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    setError(null);
    setRunning(true);
    try {
      await runRegWatcher();
      // poll lightly for a moment
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const out = await fetchRegWatcherStatus();
        setStatus(out);
        const st = out?.lastRun?.status;
        if (st === "succeeded" || st === "failed") break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const last = status?.lastRun;

  return (
    <div className="apgms-page">
      <div className="apgms-pageHeader">
        <div>
          <div className="apgms-h1">RegWatcher</div>
          <div className="apgms-subtle">Admin-only regulator change watcher. Operator tool only.</div>
        </div>
        <div className="apgms-row">
          <button className="apgms-btn apgms-btnSmall" onClick={() => void load()} disabled={loading || running}>
            Refresh
          </button>
          <button className="apgms-btn apgms-btnSmall apgms-btnPrimary" onClick={() => void handleRun()} disabled={running}>
            {running ? "Running..." : "Run RegWatcher"}
          </button>
        </div>
      </div>

      {error && <div className="apgms-error">{error}</div>}

      <div className="apgms-card">
        <div className="apgms-cardHeader">
          <div className="apgms-cardTitle">Status</div>
          <div className="apgms-badge">Admin only</div>
        </div>

        {loading ? (
          <div className="apgms-subtle">Loading...</div>
        ) : (
          <div className="apgms-stack">
            <div><strong>Last run:</strong> {last ? last.status : "none"}</div>
            {last?.id && <div><strong>Run ID:</strong> {last.id}</div>}
            {last?.startedAt && <div><strong>Started:</strong> {last.startedAt}</div>}
            {last?.finishedAt && <div><strong>Finished:</strong> {last.finishedAt}</div>}
            {last?.exitCode !== undefined && <div><strong>Exit code:</strong> {String(last.exitCode)}</div>}
            {Array.isArray(last?.lastLogLines) && last.lastLogLines.length > 0 && (
              <pre className="apgms-pre">{last.lastLogLines.join("\n")}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
