import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import * as LoginMod from "../ux/auth/pages/LoginPage";
import * as RegulatorLoginMod from "../ux/auth/pages/RegulatorLoginPage";
import * as DashboardMod from "../ux/dashboard/pages/Dashboard";
import * as ObligationsMod from "../ux/obligations/pages/Obligations";
import * as PaymentsMod from "../ux/payments/pages/Payments";
import * as LedgerMod from "../ux/ledger/pages/Ledger";
import * as ReconciliationMod from "../ux/reconciliation/pages/Reconciliation";
import * as EvidencePacksMod from "../ux/evidence/pages/EvidencePacks";
import * as ControlsMod from "../ux/controls/pages/Controls";
import * as IncidentsMod from "../ux/incidents/pages/Incidents";
import * as SettingsMod from "../ux/settings/pages/Settings";
import * as SetupWizardMod from "../ux/setup/pages/SetupWizard";
import * as RegulatorPortalMod from "../ux/regulator/pages/RegulatorPortal";
import * as PrototypeAppMod from "../proto/PrototypeApp";

// Training add-on route/page
import { ClearComplianceTrainingPage } from "../addons/clearcompliance-training";

// pickPage: allow modules that export either default or named export (common in this repo)
function pickPage(mod: any): any {
  if (mod?.default) return mod.default;
  const keys = Object.keys(mod || {});
  // prefer an obvious React component export
  const preferred = keys.find((k) => /Page$/.test(k) || /^[A-Z]/.test(k));
  return preferred ? mod[preferred] : mod[keys[0]];
}

const LoginPage = pickPage(LoginMod);
const RegulatorLoginPage = pickPage(RegulatorLoginMod);
const Dashboard = pickPage(DashboardMod);
const Obligations = pickPage(ObligationsMod);
const Payments = pickPage(PaymentsMod);
const Ledger = pickPage(LedgerMod);
const Reconciliation = pickPage(ReconciliationMod);
const EvidencePacks = pickPage(EvidencePacksMod);
const Controls = pickPage(ControlsMod);
const Incidents = pickPage(IncidentsMod);
const Settings = pickPage(SettingsMod);
const SetupWizard = pickPage(SetupWizardMod);
const RegulatorPortal = pickPage(RegulatorPortalMod);
const PrototypeApp = pickPage(PrototypeAppMod);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  // TODO: wire real auth state; for now treat presence of token as logged-in
  const token = typeof window !== "undefined" ? localStorage.getItem("apgms_session_token") : null;

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/regulator/login" element={<RegulatorLoginPage />} />

      <Route
        path="/*"
        element={
          <RequireAuth>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/obligations" element={<Obligations />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/reconciliation" element={<Reconciliation />} />
              <Route path="/evidence-packs" element={<EvidencePacks />} />
              <Route path="/controls" element={<Controls />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/training" element={<ClearComplianceTrainingPage />} />
              <Route path="/setup" element={<SetupWizard />} />

              <Route path="/regulator" element={<Navigate to="/regulator-portal" replace />} />
              <Route path="/regulator-portal" element={<RegulatorPortal />} />

              <Route path="/proto/*" element={<PrototypeApp />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
