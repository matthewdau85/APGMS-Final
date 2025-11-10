// webapp/src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import FeedsPage from "./FeedsPage";
import AlertsPage from "./AlertsPage";
import BasPage from "./BasPage";
import CompliancePage from "./CompliancePage";
import SecurityPage from "./SecurityPage";
import ProtectedLayout from "./ProtectedLayout";
import RegulatorLoginPage from "./RegulatorLoginPage";
import RegulatorLayout from "./RegulatorLayout";
import RegulatorOverviewPage from "./RegulatorOverviewPage";
import RegulatorEvidencePage from "./RegulatorEvidencePage";
import RegulatorMonitoringPage from "./RegulatorMonitoringPage";
import { SessionProvider } from "./auth/SessionContext";

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
        {/* login */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/regulator" element={<RegulatorLoginPage />} />
        <Route path="/regulator/portal" element={<RegulatorLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<RegulatorOverviewPage />} />
          <Route path="evidence" element={<RegulatorEvidencePage />} />
          <Route path="monitoring" element={<RegulatorMonitoringPage />} />
        </Route>
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/feeds" element={<FeedsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/bas" element={<BasPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/security" element={<SecurityPage />} />
        </Route>
        {/* catch-all */}
        <Route
          path="*"
          element={
            <div style={{ fontFamily: "system-ui", padding: 24 }}>
              Not found
            </div>
          }
        />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
