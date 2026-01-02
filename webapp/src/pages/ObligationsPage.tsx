import React from "react";
import { apiGet } from "../../api/client";
import { usePrototypeContext } from "../usePrototypeContext";
import "../../ui/ui.css";

type Obligations = {
  ok: boolean;
  period: string;
  obligations: Array<{
    id: string;
    type: string;
    dueDate: string;
    status: string;
    risk: "low" | "medium" | "high";
    notes: string;
  }>;
};

export default function ObligationsPage() {
  const { period } = usePrototypeContext();
  const [data, setData] = React.useState<Obligations | null>(null);

  React.useEffect(() => {
    let alive = true;
    apiGet<Obligations>(`/prototype/obligations?period=${encodeURIComponent(period)}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [period]);

  return (
    <div className="grid">
      <div className="card">
        <h1 className="h1">Obligations</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Mock obligations by period. This is the surface you later wire to real BAS/PAYGW/Super logic.
        </p>

        <table className="table" aria-label="Obligations table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Due</th>
              <th>Status</th>
              <th>Risk</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {(data?.obligations ?? []).map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.type}</td>
                <td className="muted">{o.dueDate}</td>
                <td className="muted">{o.status}</td>
                <td>
                  <span className={`chip ${o.risk === "high" ? "red" : o.risk === "medium" ? "amber" : "green"}`}>
                    {o.risk}
                  </span>
                </td>
                <td className="muted">{o.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
