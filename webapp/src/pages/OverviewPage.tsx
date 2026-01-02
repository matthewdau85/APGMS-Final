import React from "react";
import { apiGet } from "../../api/client";
import { usePrototypeContext } from "../usePrototypeContext";
import "../../ui/ui.css";

type Overview = {
  ok: boolean;
  orgId: string | null;
  period: string;
  generatedAt: string;
  kpis: Array<{ label: string; value: any; status: "green" | "amber" | "red" }>;
  timeline: Array<{ at: string; type: string; detail: string }>;
};

export default function OverviewPage() {
  const { period } = usePrototypeContext();
  const [data, setData] = React.useState<Overview | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setErr(null);
    apiGet<Overview>(`/prototype/overview?period=${encodeURIComponent(period)}`)
      .then((d) => alive && setData(d))
      .catch((e: any) => alive && setErr(e?.message ?? "Failed"));
    return () => {
      alive = false;
    };
  }, [period]);

  return (
    <div className="grid">
      <div className="card col8">
        <h1 className="h1">Overview</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Production-look shell, prototype-only data surface.
        </p>

        {err ? <div className="chip red">{err}</div> : null}

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div className="muted">Period: <strong>{period}</strong></div>
          <div className="muted">Generated: <strong>{data?.generatedAt ?? "..."}</strong></div>
        </div>

        <div style={{ marginTop: 14 }}>
          <h2 className="h2">Timeline</h2>
          <table className="table" aria-label="Prototype timeline">
            <thead>
              <tr>
                <th>At</th>
                <th>Type</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {(data?.timeline ?? []).map((t) => (
                <tr key={`${t.at}-${t.type}`}>
                  <td className="muted">{t.at}</td>
                  <td>{t.type}</td>
                  <td className="muted">{t.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card col4">
        <h1 className="h1">Status</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          KPI tiles (mocked)
        </p>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {(data?.kpis ?? []).map((k) => (
            <div key={k.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{k.label}</div>
                <div className="muted">{String(k.value)}</div>
              </div>
              <span className={`chip ${k.status}`}>{k.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
