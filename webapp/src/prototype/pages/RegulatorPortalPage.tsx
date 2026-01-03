import React, { useMemo } from "react";
import { usePrototype } from "../store";

export default function RegulatorPortalPage() {
  const { state } = usePrototype();

  const packs = useMemo(() => state.evidencePacks.filter((p) => p.period === state.period).slice(0, 10), [state.evidencePacks, state.period]);
  const incidents = useMemo(() => state.incidents.slice(0, 10), [state.incidents]);
  const obs = useMemo(() => state.obligations.filter((o) => o.period === state.period), [state.obligations, state.period]);

  if (!state.settings.security.allowRegulatorPortal) {
    return (
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Regulator Portal</h3>
        <div className="apgms-proto__muted">Disabled in Settings (demo).</div>
      </div>
    );
  }

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Regulator Portal (read-only)</h3>
        <div className="apgms-proto__muted">
          Minimum necessary access. Reproducible artifacts, compliance summaries, and incident log (demo).
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Compliance summary (demo)</h3>
        <table className="apgms-proto__table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Obligation</th>
              <th>Stage</th>
              <th>Funded</th>
              <th>Recon open</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {obs.map((o) => (
              <tr key={o.id}>
                <td>{o.label}</td>
                <td className="apgms-proto__muted">{o.stage}</td>
                <td>{o.fundedPct}%</td>
                <td>{o.reconcileOpen}</td>
                <td className="apgms-proto__muted">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Evidence packs</h3>
        <table className="apgms-proto__table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Pack id</th>
              <th>Obligation</th>
              <th>Manifest</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td className="apgms-proto__muted">{p.obligationId}</td>
                <td className="apgms-proto__muted">{p.manifestHash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Incidents</h3>
        <table className="apgms-proto__table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Status</th>
              <th>Title</th>
              <th>Linked</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id}>
                <td>{i.severity}</td>
                <td className="apgms-proto__muted">{i.status}</td>
                <td>{i.title}</td>
                <td className="apgms-proto__muted">{i.linkedObligationIds.length ? i.linkedObligationIds.join(", ") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
