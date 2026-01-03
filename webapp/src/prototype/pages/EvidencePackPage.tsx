import React, { useMemo, useState } from "react";
import { usePrototype, describeTs } from "../store";

export default function EvidencePackPage() {
  const { state } = usePrototype();
  const packs = useMemo(() => state.evidencePacks.filter((p) => p.period === state.period), [state.evidencePacks, state.period]);
  const [selected, setSelected] = useState<string | null>(packs[0]?.id ?? null);

  const active = packs.find((p) => p.id === selected) ?? null;

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Evidence Pack</h3>
        <div className="apgms-proto__muted">
          Reproducible artifacts: same inputs, same outputs, same hashes (demo).
        </div>
      </div>

      <div className="apgms-proto__card">
        <table className="apgms-proto__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Pack id</th>
              <th>Obligation</th>
              <th>Manifest hash</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.id} onClick={() => setSelected(p.id)} style={{ cursor: "pointer" }}>
                <td className="apgms-proto__muted">{describeTs(p.ts)}</td>
                <td>{p.id}</td>
                <td className="apgms-proto__muted">{p.obligationId}</td>
                <td className="apgms-proto__muted">{p.manifestHash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active ? (
        <div className="apgms-proto__card">
          <h3 style={{ marginTop: 0 }}>Pack contents</h3>
          <div className="apgms-proto__muted">What changed since last pack is demo-mocked here.</div>

          <table className="apgms-proto__table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {active.items.map((it) => (
                <tr key={it.name}>
                  <td>{it.name}</td>
                  <td className="apgms-proto__muted">{it.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="apgms-proto__muted" style={{ marginTop: 12 }}>
            <strong>Demo delta note:</strong> last run introduced new feed events and updated reconciliation status.
          </div>
        </div>
      ) : null}
    </div>
  );
}
