import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "@/app/components/Layout";
import { AppProvider } from "@/app/context/AppContext";

import DashboardPage from "@/app/pages/Dashboard";
import ObligationsPage from "@/app/pages/Obligations";
import LedgerPage from "@/app/pages/Ledger";
import ReconciliationPage from "@/app/pages/Reconciliation";
import EvidencePacksPage from "@/app/pages/EvidencePacks";
import ControlsPoliciesPage from "@/app/pages/ControlsPolicies";
import IncidentsPage from "@/app/pages/Incidents";
import SettingsPage from "@/app/pages/Settings";

// These two are missing in the ZIP export, you must create them (next step).
import SetupWizardPage from "@/app/pages/SetupWizard";
import RegulatorPortalPage from "@/app/pages/RegulatorPortal";

export function ProtoConsole() {
  return (
    <AppProvider>
      <Layout basePath="/proto">
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="setup" element={<SetupWizardPage />} />

          <Route path="obligations" element={<ObligationsPage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="reconciliation" element={<ReconciliationPage />} />

          <Route path="evidence-pack" element={<EvidencePacksPage />} />
          <Route path="controls" element={<ControlsPoliciesPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route path="regulator" element={<RegulatorPortalPage />} />

          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Layout>
    </AppProvider>
  );
}
