import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";

// Import as namespace so we can support either `export default` or `export const X`.
import * as DashboardMod from "./pages/Dashboard";
import * as ObligationsMod from "./pages/Obligations";
import * as LedgerMod from "./pages/Ledger";
import * as ReconciliationMod from "./pages/Reconciliation";
import * as EvidencePacksMod from "./pages/EvidencePacks";
import * as ControlsMod from "./pages/Controls";
import * as IncidentsMod from "./pages/Incidents";
import * as SettingsMod from "./pages/Settings";
import RegulatorPortal from "./pages/RegulatorPortal";
import SetupWizard from "./pages/SetupWizard";

type AnyComponent = React.ComponentType<any>;

function pickPage(mod: any, named: string): AnyComponent {
  return (mod?.[named] ?? mod?.default) as AnyComponent;
}

const Dashboard = pickPage(DashboardMod, "Dashboard");
const Obligations = pickPage(ObligationsMod, "Obligations");
const Ledger = pickPage(LedgerMod, "Ledger");
const Reconciliation = pickPage(ReconciliationMod, "Reconciliation");
const EvidencePacks = pickPage(EvidencePacksMod, "EvidencePacks");
const Controls = pickPage(ControlsMod, "Controls");
const Incidents = pickPage(IncidentsMod, "Incidents");
const Settings = pickPage(SettingsMod, "Settings");

export default function App() {
  // NOTE: No BrowserRouter here. Router must live in main.tsx only.
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/obligations" element={<Obligations />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/evidence-packs" element={<EvidencePacks />} />
        <Route path="/controls" element={<Controls />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/regulator-portal" element={<RegulatorPortal />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
