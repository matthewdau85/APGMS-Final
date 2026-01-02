import React, { useMemo, useState } from "react";
import { Button, Card, Tag } from "../components/ui";
import { usePrototype } from "../store";

export default function EvidencePackPage() {
  const { state, actions } = usePrototype();
  const [openId, setOpenId] = useState<string | null>(null);

  const packs = useMemo(() => state.evidencePacks.filter((p) => p.period === state.currentPeriod), [state.evidencePacks, state.currentPeriod]);

  const selected = useMemo(() => state.evidencePacks.find((p) => p.id === openId) ?? null, [state.evidencePacks, openId]);

  return (
    <div className="apgms-grid">
      <div className="apgms-col-6">
        <Card title="Evidence Packs" right={<Button onClick={actions.generateEvidencePack}>Generate</Button>}>
          <div className="apgms-muted" style={{ marginBottom: 10 }}>
            Packs are mocked, but structured like production: manifest + checksums + snapshots of obligations/ledger/controls/incidents.
          </div>

          <table className="apgms-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id}>
                  <td className="apgms-muted">{new Date(p.createdAt).toLocaleString()}</td>
                  <td style={{ fontWeight: 800 }}>{p.id}</td>
                  <td>
                    <Button variant="ghost" onClick={() => setOpenId(p.id)}>Open</Button>
                  </td>
                </tr>
              ))}
              {packs.length === 0 && (
                <tr><td colSpan={3} className="apgms-muted">No packs for this period.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="apgms-col-6">
        <Card title="Manifest (read-only)">
          {!selected && <div className="apgms-muted">Select an evidence pack to view its manifest.</div>}
          {selected && (
            <>
              <div className="apgms-row" style={{ marginBottom: 10 }}>
                <Tag tone="muted">Period: {selected.period}</Tag>
                <Tag tone="muted">Created: {new Date(selected.createdAt).toLocaleString()}</Tag>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, lineHeight: 1.5 }}>
                {selected.manifestLines.join("\n")}
              </pre>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
