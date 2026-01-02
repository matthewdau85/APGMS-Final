import React from "react";
import { apiPost } from "../../api/client";
import { usePrototypeContext } from "../usePrototypeContext";
import "../../ui/ui.css";

export default function EvidencePackPage() {
  const { period } = usePrototypeContext();
  const [busy, setBusy] = React.useState(false);
  const [pack, setPack] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost("/prototype/evidence-pack/generate", { period });
      setPack(res);
    } catch (e: any) {
      setError(e?.message ?? "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <div className="card col6">
        <h1 className="h1">Evidence Pack</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Prototype generation (mock manifest + file list).
        </p>

        <button className="button primary" onClick={generate} disabled={busy}>
          {busy ? "Generating..." : "Generate Evidence Pack (mock)"}
        </button>

        {error ? <div className="chip red" style={{ marginTop: 10 }}>{error}</div> : null}
      </div>

      <div className="card col6">
        <h1 className="h1">Output</h1>
        {pack ? (
          <pre className="muted" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(pack, null, 2)}
          </pre>
        ) : (
          <p className="muted">No pack generated yet.</p>
        )}
      </div>
    </div>
  );
}
