import React from "react";
import { apiPost } from "../../api/client";
import { usePrototypeContext } from "../usePrototypeContext";
import "../../ui/ui.css";

export default function LodgmentsPage() {
  const { period } = usePrototypeContext();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submitBas() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost("/prototype/lodgments/bas", { period });
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <div className="card col6">
        <h1 className="h1">Lodgments</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Prototype BAS lodgment flow (mock accept + receipt).
        </p>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <div className="pill">
            <span className="muted">Period</span>
            <strong>{period}</strong>
          </div>

          <button className="button primary" onClick={submitBas} disabled={busy}>
            {busy ? "Submitting..." : "Submit BAS (mock)"}
          </button>

          {error ? <div className="chip red">{error}</div> : null}
          {result ? (
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700 }}>Result</div>
              <pre className="muted" style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 8 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card col6">
        <h1 className="h1">Design intent</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          This page mirrors the production flow:
          draft → validation → submission → receipt → evidence pack.
          Today it returns mocked acceptance and a receipt token.
        </p>
      </div>
    </div>
  );
}
