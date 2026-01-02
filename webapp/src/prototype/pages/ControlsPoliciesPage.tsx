import React from "react";
import { Card, Tag } from "../components/ui";
import { usePrototype } from "../store";

export default function ControlsPoliciesPage() {
  const { state } = usePrototype();

  return (
    <div className="apgms-grid">
      <div className="apgms-col-12">
        <Card title="Controls & Policies">
          <div className="apgms-muted" style={{ marginBottom: 10 }}>
            Mock control inventory. In production: link each control to evidence artifacts, owners, testing cadence, and exceptions.
          </div>
          <table className="apgms-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Control</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {state.controls.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 800 }}>{c.area}</td>
                  <td>{c.name}</td>
                  <td>
                    <Tag tone={c.status === "pass" ? "good" : c.status === "warn" ? "warn" : "bad"}>
                      {c.status}
                    </Tag>
                  </td>
                  <td className="apgms-muted">{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
