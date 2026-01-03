import React, { useMemo, useState } from "react";
import { useDemoStore } from "../store";
import { StatusPill } from "../components/StatusPill";

export default function IncidentsPage() {
  const { incidents, obligations, createIncident, period } = useDemoStore();
  const [title, setTitle] = useState("Feed delay");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [description, setDescription] = useState("Bank feed delayed beyond expected interval. Review integration and reconcile once received.");
  const [obId, setObId] = useState("");

  const rows = useMemo(() => incidents.filter((i) => i.period === period), [incidents, period]);

  const submit = () => {
    createIncident({
      title: title.trim() || "Incident",
      severity,
      description: description.trim() || "Incident created in demo.",
      obligationIds: obId ? [obId] : [],
    });
  };

  return (
    <div className="apgms-proto__section">
      <div className="apgms-proto__h1">Incidents</div>
      <div className="apgms-proto__muted" style={{ marginTop: 6 }}>
        {"Incidents are first-class so operational failures become explainable and evidenced."}
      </div>

      <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
        <div style={{ fontWeight: 900 }}>Create incident (demo)</div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: 10 }}>
          <div>
            <label className="apgms-proto__muted">Title</label>
            <input className="apgms-proto__input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
          </div>
          <div>
            <label className="apgms-proto__muted">Severity</label>
            <select className="apgms-proto__input" value={severity} onChange={(e) => setSeverity(e.target.value as any)} style={{ width: "100%", marginTop: 6 }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="apgms-proto__muted">Description</label>
            <input className="apgms-proto__input" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="apgms-proto__muted">Link to obligation (optional)</label>
            <select className="apgms-proto__input" value={obId} onChange={(e) => setObId(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
              <option value="">No linked obligation</option>
              {obligations.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <button className="apgms-proto__btn apgms-proto__btn--primary" onClick={submit}>Create incident</button>
        </div>
      </div>

      <table className="apgms-proto__table">
        <thead>
          <tr>
            <th style={{ width: 190 }}>Time</th>
            <th style={{ width: 120 }}>Severity</th>
            <th style={{ width: 120 }}>Status</th>
            <th>Title</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 40).map((i) => (
            <tr key={i.id}>
              <td style={{ opacity: 0.8 }}>{new Date(i.ts).toLocaleString()}</td>
              <td><StatusPill text={i.severity} /></td>
              <td><StatusPill text={i.status} /></td>
              <td style={{ opacity: 0.9 }}>
                <div style={{ fontWeight: 800 }}>{i.title}</div>
                <div className="apgms-proto__muted" style={{ marginTop: 4 }}>{i.description}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
