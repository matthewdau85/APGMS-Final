import React, { useMemo, useState } from "react";
import { useDemoStore } from "../store";
import { StatusPill } from "../components/StatusPill";

export default function EvidencePackPage() {
  const { evidencePacks, obligations, period } = useDemoStore();
  const [selectedId, setSelectedId] = useState<string>("");

  const packs = useMemo(() => evidencePacks.filter((p) => p.period === period), [evidencePacks, period]);
  const selected = packs.find((p) => p.id === selectedId) ?? packs[0] ?? null;

  const obligationLabel = (id: string) => obligations.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Evidence Pack</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Regulator-grade artifact. Reproducible: same inputs, same outputs, same hashes (demo)."}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select className="apgms-proto__input" value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
          {packs.length === 0 ? <option value="">No packs yet</option> : null}
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {new Date(p.ts).toLocaleString()} - {obligationLabel(p.obligationId)}
            </option>
          ))}
        </select>

        <StatusPill text={"Packs: " + String(packs.length)} />
      </div>

      {selected ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900 }}>{selected.title}</div>
          <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
            Manifest hash (demo): <span style={{ fontWeight: 800 }}>{selected.manifestHash}</span>
          </div>

          <table className="apgms-proto__table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>File</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map((it) => (
                <tr key={it.name}>
                  <td><StatusPill text={it.name} /></td>
                  <td style={{ opacity: 0.9 }}>{it.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>What changed since last pack</div>
            <div className="apgms-proto__muted" style={{ marginTop: 6 }}>{selected.diffNote}</div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }} className="apgms-proto__muted">
          Generate a pack from an obligation to populate this view.
        </div>
      )}
    </div>
  );
}
