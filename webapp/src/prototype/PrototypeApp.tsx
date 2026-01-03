import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DemoStoreProvider } from "./store";
import PrototypeShell from "./PrototypeShell";

import DashboardPage from "./pages/DashboardPage";
import ObligationsPage from "./pages/ObligationsPage";
import ObligationDetailPage from "./pages/ObligationDetailPage";
import LedgerPage from "./pages/LedgerPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import EvidencePackPage from "./pages/EvidencePackPage";
import ControlsPoliciesPage from "./pages/ControlsPoliciesPage";
import IncidentsPage from "./pages/IncidentsPage";
import SettingsPage from "./pages/SettingsPage";
import RegulatorPortalPage from "./pages/RegulatorPortalPage";
import DemoGuidePage from "./pages/DemoGuidePage";

function RequireAdmin(props: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const loc = useLocation();

  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) {
    // Direct URL protection: non-admin redirected away
    return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  }
  return <>{props.children}</>;
}

export function PrototypeApp() {
  return (
    <RequireAdmin>
      <DemoStoreProvider>
        <Routes>
          <Route element={<PrototypeShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/obligations" element={<ObligationsPage />} />
            <Route path="/obligations/:obligationId" element={<ObligationDetailPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/evidence" element={<EvidencePackPage />} />
            <Route path="/controls" element={<ControlsPoliciesPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/regulator" element={<RegulatorPortalPage />} />
            <Route path="/demo" element={<DemoGuidePage />} />
            <Route path="/" element={<Navigate to="/proto/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/proto/dashboard" replace />} />
          </Route>
        </Routes>
      </DemoStoreProvider>
    </RequireAdmin>
  );
}
