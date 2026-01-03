import React from "react";
import { usePrototype, computeDashboardSignals, describeTs } from "../store";

function Pill(props: { kind: "good" | "warn" | "bad"; children: React.ReactNode }) {
  return <span className={"apgms-proto__pill " + props.kind}>{props.children}</span>;
}

export default function DashboardPage() {
  const { state, toggleSimulation } = usePrototype();
  const sig = computeDashboardSignals(state);

  const simOn = state.settings.simulation.enabled;

  return (
    <div className="apgms-proto__grid">
      <div className="apgms-proto__cards">
        <div className="apgms-proto__card">
          <h3>Funded (avg)</h3>
          <div style={{ marginTop: 8, fontSize: 28, letterSpacing: "-0.03em" }}>{sig.fundedAvgPct}%</div>
          <div className="apgms-proto__muted">Across obligations in the selected period.</div>
        </div>

        <div className="apgms-proto__card">
          <h3>Reconcile pending</h3>
          <div style={{ marginTop: 8, fontSize: 28, letterSpacing: "-0.03em" }}>{sig.reconcilePending}</div>
          <div className="apgms-proto__muted">Items requiring operator classification or confirmation.</div>
        </div>

        <div className="apgms-proto__card">
          <h3>Ready to lodge</h3>
          <div style={{ marginTop: 8, fontSize: 28, letterSpacing: "-0.03em" }}>{sig.readyToLodge}</div>
          <div className="apgms-proto__muted">Draft present, reconciliation cleared (demo rules).</div>
        </div>

        <div className="apgms-proto__card">
          <h3>Overdue risk</h3>
          <div style={{ marginTop: 8, fontSize: 28, letterSpacing: "-0.03em" }}>{sig.overdueRisk}</div>
          <div className="apgms-proto__muted">Flags that warrant escalation (demo).</div>
        </div>
      </div>

      <div className="apgms-proto__card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Simulation</h3>
            <div className="apgms-proto__muted">
              When enabled, APGMS receives simulated bank feed events on a schedule and posts derived ledger entries.
            </div>
          </div>

          <button className="apgms-proto__btn" onClick={() => toggleSimulation(!simOn)}>
            Simulation: {simOn ? "ON" : "OFF"}
          </button>
        </div>

        <div className="apgms-proto__muted" style={{ marginTop: 10 }}>
          Default cadence is less frequent (60s). You can change it in Settings.
        </div>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Predictive signals (demo)</h3>
        <div className="apgms-proto__muted">
          These are demo heuristics to make the prototype feel production-grade. In production you would drive these from real telemetry, ledgers, and obligation calendars.
        </div>

        <table className="apgms-proto__table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Obligation</th>
              <th>Projected funding</th>
              <th>Likelihood to lodge</th>
              <th>Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {sig.forecast.map((f) => {
              const kind = f.lodgeLikelihoodPct >= 75 ? "good" : f.lodgeLikelihoodPct >= 45 ? "warn" : "bad";
              return (
                <tr key={f.obligationId}>
                  <td>{f.label}</td>
                  <td>{f.projectedFundingPct}%</td>
                  <td><Pill kind={kind}>{f.lodgeLikelihoodPct}%</Pill></td>
                  <td className="apgms-proto__muted">
                    {kind === "good" ? "On track if inputs remain stable." : kind === "warn" ? "Watch reconciliation and funding gates." : "Escalate: shortfall or missing gates."}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="apgms-proto__card">
        <h3 style={{ marginTop: 0 }}>Recent activity</h3>
        <div className="apgms-proto__muted">Event-backed timeline used for evidence pack generation.</div>

        <table className="apgms-proto__table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sig.recentEvents.map((e) => (
              <tr key={e.id}>
                <td className="apgms-proto__muted">{describeTs(e.ts)}</td>
                <td>{e.type}</td>
                <td className="apgms-proto__muted">{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
