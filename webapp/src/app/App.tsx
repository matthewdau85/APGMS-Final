import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "../ux/shared/components/Layout";
import { AppProvider } from "../ux/shared/hooks/AppContext";

// Import as namespace so we can support either `export default` or `export const X`.
import * as DashboardMod from "../ux/dashboard/pages/Dashboard";
import * as ObligationsMod from "../ux/obligations/pages/Obligations";
import * as LedgerMod from "../ux/ledger/pages/Ledger";
import * as ReconciliationMod from "../ux/reconciliation/pages/Reconciliation";
import * as EvidencePacksMod from "../ux/evidence/pages/EvidencePacks";
import * as ControlsMod from "../ux/controls/pages/Controls";
import * as IncidentsMod from "../ux/incidents/pages/Incidents";
import * as SettingsMod from "../ux/settings/pages/Settings";
import * as PaymentsMod from "../ux/payments/pages/Payments";

import * as PrototypeAppMod from "../prototype/PrototypeApp";

import RegulatorPortal from "../ux/regulator/pages/RegulatorPortal";
import SetupWizard from "../ux/setup/pages/SetupWizard";
import RegulatorLoginPage from "../RegulatorLoginPage";

type AnyComponent = React.ComponentType<any>;

function pickPage(mod: any, named: string): AnyComponent {
  const candidate = mod?.[named] ?? mod?.default;
  if (typeof candidate === "function") return candidate as AnyComponent;

  // Safe fallback so a missing export doesn't crash the router at runtime.
  return function MissingPage() {
    return (
      <div style={{ padding: 16 }}>
        Missing page export: <code>{named}</code>
      </div>
    );
  };
}

const Dashboard = pickPage(DashboardMod, "Dashboard");
const Obligations = pickPage(ObligationsMod, "Obligations");
const Ledger = pickPage(LedgerMod, "Ledger");
const Reconciliation = pickPage(ReconciliationMod, "Reconciliation");
const EvidencePacks = pickPage(EvidencePacksMod, "EvidencePacks");
const Controls = pickPage(ControlsMod, "Controls");
const Incidents = pickPage(IncidentsMod, "Incidents");
const Settings = pickPage(SettingsMod, "Settings");
const Payments = pickPage(PaymentsMod, "Payments");

const PrototypeApp = pickPage(PrototypeAppMod, "PrototypeApp");

export default function App() {
  // NOTE: No BrowserRouter here. Router must live in main.tsx only.
  return (
    <AppProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route path="/obligations" element={<Obligations />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/reconciliation" element={<Reconciliation />} />
          <Route path="/evidence-packs" element={<EvidencePacks />} />
          <Route path="/controls" element={<Controls />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/settings" element={<Settings />} />

          {/* Compatibility: if anything still links to /login */}
          <Route path="/login" element={<Navigate to="/regulator/login" replace />} />

          {/* Regulator flow */}
          <Route path="/regulator/login" element={<RegulatorLoginPage />} />
          <Route path="/regulator" element={<Navigate to="/regulator-portal" replace />} />
          <Route path="/regulator-portal" element={<RegulatorPortal />} />

          {/* Setup */}
          <Route path="/setup" element={<SetupWizard />} />

          {/* Prototype console/app (keep isolated under /proto) */}
          <Route path="/proto/*" element={<PrototypeApp />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AppProvider>
  );
}
