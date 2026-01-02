import React, { useMemo, useState } from "react";
import { Button, Card, Field, Tag } from "../components/ui";
import { usePrototype } from "../store";

export default function IncidentsPage() {
  const { state, actions } = usePrototype();
  const [title, setTitle] = useState("New incident (mock)");
  const [sev, setSev] = useState<"SEV-1" | "SEV-2" | "SEV-3">("SEV-3");

  const openCount = useMemo(() => state.incidents.filter((i) => i.status !== "closed").length, [state.incidents]);

  return (
    <div className="apgms-grid">
      <div className="apgms-col-4">
        <Card title="Create incident">
          <Field label="Title">
            <input className="apgms-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Severity">
            <select className="apgms-input" value={sev} onChange={(e) => setSev(e.target.value as any)}>
              <option value="SEV-1">SEV-1</option>
              <option value="SEV-2">SEV-2</option>
              <option value="SEV-3">SEV-3</option>
            </select>
          </Field>
          <Button onClick={() => actions.createIncident(title, sev)} style={{ width: "100%" }}>Create</Button>
          <div className="apgms-muted" style={{ marginTop: 10 }}>Open (incl mitigated): {openCount}</div>
        </Card>
      </div>

      <div className="apgms-col-8">
        <Card title="Incident log">
          <table className="apgms-table">
            <thead>
              <tr>
                <th>Opened</th>
                <th>Severity</th>
                <th>Title</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.incidents.map((i) => (
                <tr key={i.id}>
                  <td className="apgms-muted">{new Date(i.openedAt).toLocaleString()}</td>
                  <td><Tag tone={i.severity === "SEV-1" ? "bad" : i.severity === "SEV-2" ? "warn" : "muted"}>{i.severity}</Tag></td>
                  <td style={{ fontWeight: 800 }}>{i.title}</td>
                  <td><Tag tone={i.status === "open" ? "bad" : i.status === "mitigated" ? "warn" : "good"}>{i.status}</Tag></td>
                  <td className="apgms-muted">{i.owner}</td>
                  <td>
                    <div className="apgms-row">
                      <Button variant="ghost" onClick={() => actions.mitigateIncident(i.id)} disabled={i.status !== "open"}>Mitigate</Button>
                      <Button variant="ghost" onClick={() => actions.closeIncident(i.id)} disabled={i.status === "closed"}>Close</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
