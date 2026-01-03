import React, { useMemo, useState } from "react";
import { usePrototype, describeTs } from "../store";

export default function IncidentsPage() {
  const { state, createIncident } = usePrototype();
  const incidents = useMemo(() => state.incidents.slice(0, 60), [state.incidents]);

  const obs = useMemo(() => state.obligations.filter((o) => o.period === state.period), [state.obligations, state.period]);

  const [title, setTitle] = useState("Feed delay");
  const [desc, setDesc] = useState("Incoming feed arrived later than expected. Reconciliation gates may be impacted.");
  const [sev, setSev] = useState<"SEV-1" | "SEV-2" | "SEV-3">("SEV-3");
  const [linkOb, setLinkOb] = useState<string>("");

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Incidents</h3>
        <div className="apgms-proto__muted">
          Incidents are first-class so operational failures become explainable and evidenced.
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Create incident (demo)</h3>

        <div className="apgms-proto__field">
          <label>Severity</label>
          <select className="apgms-proto__select" value={sev} onChange={(e) => setSev(e.target.value as any)}>
            <option value="SEV-1">SEV-1</option>
            <option value="SEV-2">SEV-2</option>
            <option value="SEV-3">SEV-3</option>
          </select>
        </div>

        <div className="apgms-proto__field">
          <label>Title</label>
          <input className="apgms-proto__input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="apgms-proto__field">
          <label>Description</label>
          <input className="apgms-proto__input" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="apgms-proto__field">
          <label>Link to obligation (optional)</label>
          <select className="apgms-proto__select" value={linkOb} onChange={(e) => setLinkOb(e.target.value)}>
            <option value="">None</option>
            {obs.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            className="apgms-proto__btn"
            onClick={() => createIncident({ severity: sev, title: title.trim(), description: desc.trim(), linkedObligationIds: linkOb ? [linkOb] : [] })}
          >
            Create incident
          </button>
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Incident log</h3>

        <table className="apgms-proto__table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Title</th>
              <th>Linked</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id}>
                <td className="apgms-proto__muted">{describeTs(i.ts)}</td>
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
