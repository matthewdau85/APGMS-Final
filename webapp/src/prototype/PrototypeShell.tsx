import React from "react";
import "./prototype.css";
import { Button } from "./components/ui";
import { usePrototype } from "./store";
import type { Period } from "./mockData";

export type NavId =
  | "dashboard"
  | "obligations"
  | "ledger"
  | "reconciliation"
  | "evidence"
  | "controls"
  | "incidents"
  | "settings"
  | "regulator";

export type NavItem = { id: NavId; label: string };

export default function PrototypeShell(props: {
  nav: NavItem[];
  current: NavId;
  onNavigate: (id: NavId) => void;
  onExit: () => void;
  children: React.ReactNode;
}) {
  const { state, actions } = usePrototype();
  const periods: Period[] = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"];

  return (
    <div className="apgms-root">
      <div className="apgms-shell">
        <aside className="apgms-side">
          <div className="apgms-brand">
            <div className="apgms-logo">A</div>
            <div>
              <div className="apgms-brand-title">APGMS</div>
              <div className="apgms-brand-sub">Admin prototype (mock)</div>
            </div>
          </div>

          <div className="apgms-nav">
            {props.nav.map((item) => (
              <button
                key={item.id}
                className={"apgms-nav-btn " + (item.id === props.current ? "active" : "")}
                onClick={() => props.onNavigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
            <div className="apgms-muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Org: {state.settings.orgName}
            </div>
            <Button variant="ghost" onClick={props.onExit} style={{ width: "100%" }}>
              Exit Admin
            </Button>
          </div>
        </aside>

        <main className="apgms-main">
          <header className="apgms-top">
            <div className="apgms-top-left">
              <div>
                <div className="apgms-top-title">APGMS Prototype</div>
                <div className="apgms-top-sub">Production-look UX with mocked data, feeds, lodgments</div>
              </div>
            </div>

            <div className="apgms-top-right">
              <div className="apgms-row">
                <span className="apgms-muted" style={{ fontSize: 12 }}>Period</span>
                <select className="apgms-input" style={{ width: 140 }} value={state.currentPeriod} onChange={(e) => actions.setPeriod(e.target.value as Period)}>
                  {periods.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <Button variant="ghost" onClick={actions.ingestFeeds}>Mock Ingest Feeds</Button>
              <Button onClick={actions.generateEvidencePack}>Generate Evidence Pack</Button>
            </div>
          </header>

          <div className="apgms-content">{props.children}</div>
        </main>
      </div>
    </div>
  );
}
